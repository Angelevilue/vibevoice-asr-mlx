#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Streaming Agent - V3 (create_react_agent 异步流式版)
====================================================
1. 使用 create_react_agent + astream_events(v2) 实现稳定异步流式
2. Python 3.10 完全支持
3. 核心业务逻辑（工具选择、统计、历史管理）
"""

import logging
import os
import json
import time
import functools
import traceback
import inspect
import threading
import asyncio
from datetime import datetime
from typing import List, Dict, Any, Optional, Callable, Union, AsyncGenerator
from dataclasses import dataclass, field
from collections import deque
from dotenv import load_dotenv

# ==================== 🔥 核心导入变更 🔥 ====================
from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI
from langchain_deepseek import ChatDeepSeek
from langchain_core.tools import tool, BaseTool
from langchain_core.messages import HumanMessage, AIMessage, AIMessageChunk, ToolMessage, BaseMessage
from langchain_core.exceptions import OutputParserException
# =========================================================

from get_system_prompt import get_system_prompt


# ==================== 1. 配置 ====================
logging.basicConfig(
    level=logging.INFO,  # 🔥 生产环境：只看 info 及以上
    # level=logging.DEBUG,  # 🔍 开发环境：查看调试详情
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('agent.log', encoding='utf-8', mode='a')
    ]
)

logger = logging.getLogger(__name__)

load_dotenv(override=True)


# ==================== 2. 统计数据结构 (保持不变) ====================
@dataclass
class StreamingStats:
    """流式输出统计信息"""
    main_model_ttft: float = 0.0
    total_tokens: int = 0
    tool_calls: List[Dict[str, Any]] = field(default_factory=list)
    main_model_total_time: float = 0.0
    total_time: float = 0.0
    history_messages_count: int = 0
    error_occurred: bool = False
    error_message: str = ""
    
    def log_summary(self):
        """打印统计摘要"""
        logger.info("=" * 60)
        logger.info("📊 性能统计")
        logger.info("=" * 60)
        logger.info(f"⏱️  主模型 TTFT: {self.main_model_ttft:.3f}s")
        logger.info(f"⏱️  主模型总耗时：{self.main_model_total_time:.3f}s")
        logger.info(f"📝 总 Token 数：{self.total_tokens}")
        logger.info(f"💬 历史消息数：{self.history_messages_count}")
        logger.info(f"🔧 工具调用次数：{len(self.tool_calls)}")
        for i, tc in enumerate(self.tool_calls, 1):
            logger.info(f"   工具{i}: {tc['name']} | 耗时：{tc['duration']:.3f}s")
        logger.info(f"⏱️  全流程总耗时：{self.total_time:.3f}s")
        if self.error_occurred:
            logger.error(f"⚠️  处理过程中发生错误：{self.error_message}")
        logger.info("=" * 60)


# ==================== 3. 对话历史管理器 ====================
class ConversationManager:
    def __init__(self, max_history_rounds: int = 10, max_sessions: int = 1000):
        self.max_history_rounds = max_history_rounds
        self.max_sessions = max_sessions
        self._sessions: Dict[str, deque] = {}
        self._lock = threading.Lock()
        logger.info(f"💬 对话管理器初始化，最大历史轮数：{max_history_rounds}, 最大会话数：{max_sessions}")
    
    def set_max_rounds(self, rounds: int):
        try:
            if rounds <= 0: raise ValueError("历史轮数必须大于 0")
            self.max_history_rounds = rounds
            for session_id, history in self._sessions.items():
                max_messages = rounds * 2
                while len(history) > max_messages: history.popleft()
        except Exception as e:
            logger.error(f"❌ 设置历史轮数失败：{e}")
            raise
    
    def get_history(self, session_id: str) -> List[BaseMessage]:
        try:
            if not session_id or not isinstance(session_id, str): return []
            if session_id not in self._sessions: return []
            return list(self._sessions[session_id])
        except Exception as e:
            logger.error(f"❌ 获取历史记录失败 [{session_id}]: {e}")
            return []
    
    def add_message(self, session_id: str, message: BaseMessage):
        with self._lock:
            try:
                if not session_id or not isinstance(session_id, str): raise ValueError(f"无效的 session_id: {session_id}")
                if not isinstance(message, BaseMessage): raise TypeError(f"消息类型错误：{type(message)}")
                if session_id not in self._sessions and len(self._sessions) >= self.max_sessions:
                    oldest_sid = next(iter(self._sessions))
                    del self._sessions[oldest_sid]
                if session_id not in self._sessions: self._sessions[session_id] = deque()
                history = self._sessions[session_id]
                history.append(message)
                max_messages = self.max_history_rounds * 2
                while len(history) > max_messages: history.popleft()
            except Exception as e:
                logger.error(f"❌ 添加消息失败 [{session_id}]: {e}")
                raise
    
    def add_exchange(self, session_id: str, user_message: HumanMessage, ai_message: AIMessage):
        try:
            self.add_message(session_id, user_message)
            self.add_message(session_id, ai_message)
        except Exception as e:
            logger.error(f"❌ 添加对话交换失败 [{session_id}]: {e}")
            raise
    
    def clear_history(self, session_id: str):
        try:
            if session_id in self._sessions:
                self._sessions[session_id].clear()
        except Exception as e:
            logger.error(f"❌ 清空历史失败 [{session_id}]: {e}")
            raise
    
    def get_session_info(self) -> Dict[str, int]:
        try:
            return {sid: len(history) // 2 for sid, history in self._sessions.items()}
        except Exception as e:
            logger.error(f"❌ 获取会话信息失败：{e}")
            return {}


# ==================== 4. 工具注册表 ====================
from caiyun_weather_tools_async import (
    search_realtime_weather,
    search_hourly_forecast,
    search_daily_forecast,
    search_weather_alerts,
)

TOOL_REGISTRY = {
    "search_realtime_weather": search_realtime_weather,
    "search_hourly_forecast": search_hourly_forecast,
    "search_daily_forecast": search_daily_forecast,
    "search_weather_alerts": search_weather_alerts,
}
logger.info(f"✅ 主程序加载了 {len(TOOL_REGISTRY)} 个工具：{list(TOOL_REGISTRY.keys())}")

tools = [search_realtime_weather, search_hourly_forecast, search_daily_forecast, search_weather_alerts]

# ==================== 5. 🔥 流式 Agent 🔥 ====================
class StreamingAgent:
    """
    流式 Agent: 
    - 使用 create_react_agent + astream_events(v2) 实现异步流式
    - astream() 是异步生成器 (AsyncGenerator)
    - 核心业务逻辑保持不变
    """
    
    def __init__(
        self, 
        main_model, 
        max_tools: int = 5, 
        max_history_rounds: int = 10
    ):
        self.main_model = main_model
        self.max_tools = max_tools
        self._agent_cache = {}
        self.conversation_manager = ConversationManager(max_history_rounds)
        self._stream_locks: Dict[str, asyncio.Lock] = {}  # 🔥 改为 asyncio.Lock
    
    def set_max_history_rounds(self, rounds: int):
        self.conversation_manager.set_max_rounds(rounds)
    
    def clear_history(self, session_id: str):
        self.conversation_manager.clear_history(session_id)
    
    async def _get_session_lock(self, session_id: str):
        """🔥 异步锁"""
        if session_id not in self._stream_locks:
            self._stream_locks[session_id] = asyncio.Lock()
        return self._stream_locks[session_id]
    
    def _create_react_graph(self, model, tools: List[BaseTool], system_prompt: str):
        """创建 ReAct Graph"""
        try:
            graph = create_react_agent(
                model=model,
                tools=tools,
                prompt=system_prompt,
                version="v2"
            )
            logger.debug(f"🔧 ReAct Graph 创建成功 | 工具数：{len(tools)}")
            return graph
        except Exception as e:
            logger.error(f"❌ ReAct Graph 创建失败：{e}")
            raise

    async def astream(
        self, 
        user_query: str, 
        session_id: str = "default",
        save_history: bool = True
    ) -> AsyncGenerator[str, None]:
        """
        🔥 异步流式接口 (astream)
        使用 create_react_agent + astream_events 实现
        """
        # 输入预处理
        if not isinstance(user_query, str): return
        user_query = "".join(user_query.split())
        if not user_query: return
        
        if not isinstance(session_id, str): session_id = "default"
        session_id = session_id.strip()
        
        stats = StreamingStats()
        total_start = time.perf_counter()
        
        # 🔥 使用异步锁
        async with await self._get_session_lock(session_id):
            try:
                logger.info(f"\n{'='*60}")
                logger.info(f"🚀 处理：{user_query[:50]}... | 会话：{session_id[:8]}...")
                
                # 第 1 步：获取提示词（使用前端传来的提示词，不再使用后端提示词）
                # system_prompt 由 ai_agent_server 在 user_query 中传递，此处使用空提示词
                system_prompt = ""
                
                # 第 2 步：🔥 创建 ReAct Graph 🔥
                try:
                    graph = self._create_react_graph(
                        model=self.main_model,
                        tools=tools,
                        system_prompt=system_prompt
                    )
                    logger.info(f"💾 创建 ReAct Graph")
                except Exception as e:
                    logger.error(f"❌ Graph 创建失败：{e}")
                    stats.error_occurred = True
                    stats.error_message = f"Graph 创建失败：{str(e)}"
                    yield "哎呀，我这边有点卡住了，稍等一下再试好吗？"
                    return
                
                # 第 3 步：构建消息列表
                try:
                    history_messages = self.conversation_manager.get_history(session_id)
                    stats.history_messages_count = len(history_messages)
                    current_message = HumanMessage(content=user_query)
                    all_messages = history_messages + [current_message]
                    logger.info(f"💬 使用历史消息：{len(history_messages)}条")
                except Exception as e:
                    logger.error(f"❌ 构建消息列表失败：{e}")
                    all_messages = [HumanMessage(content=user_query)]
                
                # 第 4 步：🔥 异步流式输出 (增强日志版) 🔥
                main_model_start = time.perf_counter()
                first_token_received = False
                current_tool_call = None
                tool_call_start = None
                full_response = []
                
                # 🔍 调试统计：事件计数和迭代跟踪
                event_counter = {"total": 0, "by_type": {}}
                iteration_counter = 0
                llm_think_start = None  # 记录 LLM 思考开始时间
                
                try:
                    logger.info(f"🔌 开始异步流式请求 (ReAct Engine)")
                    logger.debug(f"📋 输入: 消息数={len(all_messages)}, "
                               f"首条消息类型={all_messages[0].__class__.__name__ if all_messages else 'N/A'}")
                    
                    # 🔥 使用 astream_events 异步流式
                    async for event in graph.astream_events(
                        {"messages": all_messages},
                        version="v2",
                        config={"recursion_limit": 10}
                    ):
                        # 🔍 统计事件
                        event_counter["total"] += 1
                        event_type = event.get("event", "unknown")
                        event_counter["by_type"][event_type] = event_counter["by_type"].get(event_type, 0) + 1
                        
                        data = event.get("data", {})
                        name = event.get("name", "unknown")
                        
                        # ─────────────────────────────────────────────────────
                        # 🔍 关键事件日志 (info 级别，用于监控流程)
                        # ─────────────────────────────────────────────────────
                        
                        # 1. 链开始/结束：标记迭代边界
                        if event_type == "on_chain_start" and name in ["agent", "LangGraph"]:
                            iteration_counter += 1
                            logger.info(f"🔄 [迭代 #{iteration_counter}] {name} 开始")
                        
                        elif event_type == "on_chain_end" and name in ["agent", "LangGraph"]:
                            logger.info(f"🏁 [迭代 #{iteration_counter}] {name} 完成")
                        
                        # 2. LLM 开始思考
                        elif event_type == "on_chat_model_start":
                            llm_think_start = time.perf_counter()
                            messages = data.get("input", {}).get("messages", [])
                            logger.info(f"🤖 LLM 思考开始 | 消息数={len(messages)} | 迭代=#{iteration_counter}")
                            logger.debug(f"   消息类型分布: {[m.__class__.__name__ for m in messages[:3]]}")
                        
                        # 3. LLM 思考完成
                        elif event_type == "on_chat_model_end":
                            think_duration = time.perf_counter() - llm_think_start if llm_think_start else 0
                            response = data.get("output", {})
                            logger.debug(f"🤖 LLM 思考完成 | 耗时={think_duration:.3f}s | "
                                       f"响应类型={type(response).__name__}")
                        
                        # 4. 工具调用开始
                        elif event_type == "on_tool_start":
                            tool_name = name
                            tool_args = data.get("input", {})
                            logger.info(f"🔧 工具调用: {tool_name} | 参数={json.dumps(tool_args, ensure_ascii=False)[:100]}")
                            current_tool_call = tool_name
                            tool_call_start = time.perf_counter()
                            # 输出用户可见的工具提示
                            yield f"\n[正在调用工具：{tool_name}]\n"
                        
                        # 5. 工具执行完成
                        elif event_type == "on_tool_end":
                            duration = time.perf_counter() - tool_call_start if tool_call_start else 0
                            output = data.get("output", "")
                            output_preview = str(output)[:80] + "..." if len(str(output)) > 80 else str(output)
                            logger.info(f"✅ 工具完成: {current_tool_call or name} | 耗时={duration:.3f}s | 结果={output_preview}")
                            
                            # 记录到统计
                            if output:
                                stats.tool_calls.append({
                                    "name": current_tool_call or "unknown",
                                    "duration": duration,
                                    "result": str(output)[:50]
                                })
                            tool_call_start = None
                            # 输出用户可见的工具结果提示
                            yield f"\n[工具结果：{output_preview}]\n"
                        
                        # ─────────────────────────────────────────────────────
                        # 🔍 流式 Token 处理 (核心输出逻辑)
                        # ─────────────────────────────────────────────────────
                        elif event_type == "on_chat_model_stream":
                            chunk = data.get("chunk")
                            if chunk and hasattr(chunk, "content") and chunk.content:
                                content = chunk.content
                                
                                # 🎯 记录首个 Token 时间 (TTFT)
                                if not first_token_received:
                                    stats.main_model_ttft = time.perf_counter() - main_model_start
                                    first_token_received = True
                                    logger.info(f"⚡ 首个 Token (TTFT): {stats.main_model_ttft:.3f}s")
                                    logger.debug(f"📝 首个 token 内容: '{content.strip()[:30]}...'")
                                
                                # 📊 累积统计
                                stats.total_tokens += len(content)
                                full_response.append(content)
                                
                                # 🔍 调试：每 100 tokens 记录一次进度（避免日志爆炸）
                                if stats.total_tokens % 100 < len(content):
                                    logger.debug(f"📈 流式进度: {stats.total_tokens} tokens | "
                                               f"最后内容: '{content.strip()[:20]}...'")
                                
                                # 🎯 关键：异步 yield 给用户
                                yield content
                        
                        # ─────────────────────────────────────────────────────
                        # 🔍 其他事件：按需记录（debug 级别）
                        # ─────────────────────────────────────────────────────
                        elif logger.isEnabledFor(logging.DEBUG):
                            # 只记录未处理的事件类型，帮助排查问题
                            if event_type not in [
                                "on_chat_model_stream", "on_tool_start", "on_tool_end",
                                "on_chat_model_start", "on_chat_model_end",
                                "on_chain_start", "on_chain_end", "on_chain_stream"
                            ]:
                                logger.debug(f"ℹ️  事件: {event_type} | name={name} | "
                                           f"data_keys={list(data.keys()) if data else 'None'}")

                    # ─────────────────────────────────────────────────────
                    # 🔍 流式结束后：打印汇总统计
                    # ─────────────────────────────────────────────────────
                    logger.info(f"📊 事件汇总: 总数={event_counter['total']} | "
                              f"类型分布: {dict(sorted(event_counter['by_type'].items()))}")
                    logger.info(f"🔄 总迭代次数: {iteration_counter} | "
                              f"最终响应长度: {len(''.join(full_response))} 字符")

                # ─────────────────────────────────────────────────────
                # 🔍 异常处理：记录详细上下文
                # ─────────────────────────────────────────────────────
                except OutputParserException as e:
                    logger.error(f"❌ 输出解析异常: {e}")
                    logger.debug(f"📋 异常上下文: iteration={iteration_counter}, "
                              f"events={event_counter['total']}, tokens={stats.total_tokens}, "
                              f"response_preview={''.join(full_response)[-100:]}")
                    stats.error_occurred = True
                    stats.error_message = f"解析错误：{str(e)}"
                    yield "🤔 我好像没理解清楚，能换个说法再试一次吗？"
                    
                except Exception as e:
                    logger.error(f"❌ 流式输出异常: {e}")
                    logger.error(f"📋 完整堆栈:\n{traceback.format_exc()}")
                    logger.debug(f"📋 异常上下文: iteration={iteration_counter}, "
                              f"events={event_counter['total']}, tokens={stats.total_tokens}")
                    stats.error_occurred = True
                    stats.error_message = f"系统错误：{str(e)}"
                    if not full_response:
                        yield "😅 刚才网络好像抖了一下，能再说一遍吗？"
                
                # ─────────────────────────────────────────────────────
                # 第 6 步：保存对话历史 (保持不变 + 日志)
                # ─────────────────────────────────────────────────────
                if save_history and full_response and not stats.error_occurred:
                    try:
                        ai_message = AIMessage(content="".join(full_response))
                        self.conversation_manager.add_exchange(session_id, current_message, ai_message)
                        logger.debug(f"💾 已保存对话 | session={session_id[:8]}... | "
                                   f"历史轮数={len(self.conversation_manager.get_history(session_id))//2}")
                    except Exception as e:
                        logger.error(f"❌ 保存历史记录失败: {e}")
                
                # ─────────────────────────────────────────────────────
                # 统计时间 + 日志汇总
                # ─────────────────────────────────────────────────────
                stats.main_model_total_time = time.perf_counter() - main_model_start
                stats.total_time = time.perf_counter() - total_start
                
                # 🔍 记录关键性能指标
                logger.info(f"⏱️  性能: TTFT={stats.main_model_ttft:.3f}s | "
                          f"生成={stats.main_model_total_time:.3f}s | "
                          f"总耗时={stats.total_time:.3f}s | tokens={stats.total_tokens}")
                
                self.last_stats = stats
                stats.log_summary()  # 原有日志方法
                
            except Exception as e:
                logger.critical(f"💥 未捕获的异常: {e}")
                logger.critical(f"📋 堆栈跟踪:\n{traceback.format_exc()}")
                stats.error_occurred = True
                stats.error_message = f"系统错误：{str(e)}"
                stats.total_time = time.perf_counter() - total_start
                self.last_stats = stats
                yield "🔧 系统遇到点小问题，我正在修复，请稍后再试~"
                
                # 第 6 步：保存对话历史 (保持不变)
                if save_history and full_response and not stats.error_occurred:
                    try:
                        ai_message = AIMessage(content="".join(full_response))
                        self.conversation_manager.add_exchange(session_id, current_message, ai_message)
                    except Exception as e:
                        logger.error(f"❌ 保存历史记录失败：{e}")
                
                # 统计时间
                stats.main_model_total_time = time.perf_counter() - main_model_start
                stats.total_time = time.perf_counter() - total_start
                
                self.last_stats = stats
                stats.log_summary()
                
            except Exception as e:
                logger.critical(f"💥 未捕获的异常：{e}\n{traceback.format_exc()}")
                stats.error_occurred = True
                stats.error_message = f"系统错误：{str(e)}"
                stats.total_time = time.perf_counter() - total_start
                self.last_stats = stats
                yield "系统好像出了点小状况，让我缓一缓..."


# ==================== 6. 初始化 ====================
def create_streaming_agent(
    max_history_rounds: int = 10
):
    logger.info(f"📝 初始化 (历史轮数：{max_history_rounds})...")
    try:
        required_envs = ["VOLCENGINE_BASE_URL", "VOLCENGINE_API_KEY", "DASHSCOPE_SPEED_BASE_URL", "DASHSCOPE_SPEED_API_KEY"]
        missing_envs = [env for env in required_envs if not os.getenv(env)]
        if missing_envs:
            raise ValueError(f"缺少必要的环境变量：{', '.join(missing_envs)}")


        #--------------------------------------------------------------------------------------------#
        # 支持思考程度可调节（reasoning effort）：分为 minimal、low、medium、high 四种模式，其中minimal为不思考
        #--------------------------------------------------------------------------------------------#
        
        # selector_model = ChatOpenAI(
        #     base_url=os.getenv("VOLCENGINE_BASE_URL"),
        #     api_key=os.getenv("VOLCENGINE_API_KEY"),
        #     model="doubao-seed-2-0-mini-260215",
        #     temperature=0.1,
        #     max_tokens=50,  # 修复：减少token
        #     extra_body={
        #         "thinking": {"type": "disabled"},
        #         "reasoning": {"effort": "minimal"}
        #     }
        # )

        # main_model = ChatOpenAI(
        #     base_url=os.getenv("VOLCENGINE_BASE_URL"),
        #     api_key=os.getenv("VOLCENGINE_API_KEY"),
        #     model="doubao-seed-2-0-mini-260215",
        #     temperature=0.7,
        #     max_tokens=200,
        #     extra_body={
        #         "thinking": {"type": "disabled"},
        #         "reasoning": {"effort": "minimal"}
        #     }
        # )

        # selector_model = ChatOpenAI(
        #     base_url=os.getenv("DASHSCOPE_SPEED_BASE_URL"),
        #     api_key=os.getenv("DASHSCOPE_SPEED_API_KEY"),
        #     model="qwen-plus",
        #     temperature=0.1,
        #     max_tokens=50,
        #     streaming=True,
        # )

               
        # main_model = ChatOpenAI(
        #     base_url=os.getenv("DASHSCOPE_SPEED_BASE_URL"),
        #     api_key=os.getenv("DASHSCOPE_SPEED_API_KEY"),
        #     model="qwen-plus",
        #     temperature=0.7,
        #     max_tokens=200,
        #     streaming=True,
        # )

        main_model = ChatOpenAI(
            base_url=os.getenv("VOLCENGINE_BASE_URL"),
            api_key=os.getenv("ARK_API_KEY"),
            model="doubao-seed-character-251128",
            temperature=0.9,
            max_tokens=200,
            extra_body={
                "thinking": {"type": "disabled"},
                "reasoning": {"effort": "minimal"}
            }
        )
        
        agent = StreamingAgent(
            main_model=main_model,
            max_tools=5,
            max_history_rounds=max_history_rounds,
        )
        
        logger.info("✅ 初始化完成 (ReAct 异步流式)")
        return agent
        
    except Exception as e:
        logger.critical(f"💥 Agent 初始化失败：{e}")
        raise


# ==================== 7. 🔥 主函数 🔥 ====================
async def main():
    """🔥 异步主函数"""
    agent = create_streaming_agent(max_history_rounds=10)

    test_cases = [
        # ("user_001", "李白是谁"),
        # ("user_003", "讲个白雪公主的故事"),
        # ("user_006", "今天上海天气怎么样"),
        ("user_007", "我叫曦沐"),
        ("user_007", "我叫什么名字"),
        ("user_007", "介绍一下你自己"),
        # ("user_007", "今天上海和北京天气怎么样，那个地方适合旅游，最后帮我把天气信息写入文件中"),
    ]
    
    for session_id, query in test_cases:
        print(f"\n{'='*60}")
        print(f"👤 用户: {query}")
        print(f"🤖 AI: ", end="", flush=True)
        
        # 🔥 异步迭代
        async for token in agent.astream(query, session_id=session_id):
            print(token, end="", flush=True)
        
        print("\n")
        
        if hasattr(agent, 'last_stats'):
            stats = agent.last_stats
            print(f"耗时：{stats.total_time:.3f}s")


# ==================== 8. 入口 ====================
if __name__ == "__main__":
    try:
        # 🔥 异步入口
        asyncio.run(main())
        # await main()
    except KeyboardInterrupt:
        logger.info("👋 用户中断程序")
        print("\n再见！")
    except Exception as e:
        logger.critical(f"💥 顶层异常：{e}")
        print(f"程序异常退出：{e}")
