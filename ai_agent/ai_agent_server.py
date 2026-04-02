#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI Agent API Server (FastAPI)
Exposes the streaming agent as HTTP endpoint
"""

import os
import logging
import asyncio
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('agent_api.log', encoding='utf-8', mode='a')
    ]
)
logger = logging.getLogger(__name__)

# Global agent instance
agent = None


def get_agent():
    """Get or initialize the agent"""
    global agent
    if agent is None:
        from llm_engine import create_streaming_agent
        logger.info("Initializing AI Agent...")
        agent = create_streaming_agent(max_history_rounds=10)
        logger.info("AI Agent initialized successfully")
    return agent


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup: initialize agent
    get_agent()
    logger.info("AI Agent ready")
    yield
    # Shutdown
    logger.info("Shutting down AI Agent server...")


app = FastAPI(
    title="VibeVoice AI Agent",
    description="AI Agent API for transcription processing",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class AIProcessRequest(BaseModel):
    transcription: str
    prompt: str
    session_id: Optional[str] = "default"


class AIProcessResponse(BaseModel):
    result: str
    session_id: str


class HealthResponse(BaseModel):
    status: str


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(status="ok")


@app.post("/ai-process", response_model=AIProcessResponse)
async def ai_process(request: AIProcessRequest):
    """
    AI Process endpoint - receives transcription and prompt, returns processed result
    """
    if not request.transcription:
        raise HTTPException(status_code=400, detail="Transcription is required")

    # Build user query with system prompt
    user_query = f"""【系统提示词】
{request.prompt}

【待处理文本】
{request.transcription}

请根据系统提示词处理上述文本。"""

    logger.info(f"Processing AI request | session: {request.session_id[:8]}... | prompt: {request.prompt[:50]}...")

    try:
        agent_instance = get_agent()

        # Collect streaming response
        result = []
        async for token in agent_instance.astream(
            user_query,
            session_id=request.session_id
        ):
            result.append(token)

        full_result = ''.join(result)
        logger.info(f"AI processing complete | result length: {len(full_result)} chars")

        return AIProcessResponse(
            result=full_result,
            session_id=request.session_id
        )

    except Exception as e:
        logger.error(f"AI processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get('AI_AGENT_PORT', 8766))
    logger.info(f"Starting AI Agent API server on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
