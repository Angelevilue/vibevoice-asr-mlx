# VibeVoice ASR 客户端/服务端

基于 VibeVoice-ASR-4bit 语音识别的客户端-服务端架构，针对 Apple Silicon (MLX) 优化。

服务端只需加载一次模型，即可处理多个识别请求。

## 功能特点

- **客户端-服务端架构**：模型只需加载一次，支持多次识别请求
- **自动音频格式检测**：支持 WAV、MP3、M4A、OGG、FLAC，自动识别，不受文件扩展名限制
- **多种输出格式**：JSON、TXT、SRT、VTT
- **进度跟踪**：服务端实时显示识别进度
- **时间信息**：返回文本长度、音频时长、处理时间

## 环境配置

```bash
# 创建 conda 环境
conda create -n vibevoice-asr python=3.12
conda activate vibevoice-asr

# 安装依赖
pip install -r requirements.txt
```

## 模型配置

### 下载模型

```bash
# 创建模型存储目录
mkdir -p /Users/zephyrmuse/LLMs/model_weights/VibeVoice-ASR-4bit

# 从 ModelScope 下载模型
modelscope download --model mlx-community/VibeVoice-ASR-4bit --local_dir /Users/zephyrmuse/LLMs/model_weights/VibeVoice-ASR-4bit
```

### 模型路径

服务端默认查找模型的路径：
```
/Users/zephyrmuse/LLMs/model_weights/VibeVoice-ASR-4bit
```

可通过环境变量修改：
```bash
export VIBEVOICE_MODEL_PATH=/path/to/your/model
```

## 服务端

### 启动服务

```bash
python server.py
```

服务端将：
1. 加载 MLX 模型
2. 监听 `http://0.0.0.0:8765`
3. 实时打印识别进度

### 服务端选项

| 选项 | 说明 |
|------|------|
| `VIBEVOICE_MODEL_PATH` | 模型路径（默认：见上方） |
| `PORT` | 服务端口（默认：8765） |

### 健康检查

```bash
curl http://localhost:8765/health
# 返回: OK
```

## 客户端

### 基本用法

```bash
python client.py <音频文件>
```

### 参数说明

| 短参数 | 长参数 | 默认值 | 说明 |
|--------|--------|--------|------|
| `-s` | `--server` | `http://localhost:8765` | 服务端地址 |
| `-f` | `--format` | `json` | 输出格式：`txt`、`json`、`srt`、`vtt` |
| `-o` | `--output` | (标准输出) | 输出文件路径 |
| `-t` | `--timeout` | `3600` | 请求超时时间（秒） |
| | `--raw` | | 输出原始响应，不格式化 |

### 使用示例

```bash
# 基本识别（默认：带时间戳的 JSON 格式）
python client.py audio.wav

# 纯文本输出
python client.py audio.wav -f txt

# 保存到文件
python client.py audio.wav -o result.txt

# 组合使用
python client.py audio.wav -f txt -o result.txt -t 7200

# 输出原始 JSON
python client.py audio.wav --raw
```

### 输出格式

**JSON 格式（默认）：**
```
[00:00.000 - 00:18.900] Speaker 0: 人的放纵是本能，自律才是修行。...

[Info] Text: 142 chars | Audio: 18.90s | Processing: 5.75s
```

**TXT 格式：**
```
人的放纵是本能，自律才是修行。短时间能让你感到快乐的东西...

[Info] Text: 142 chars | Audio: 18.90s | Processing: 5.75s
```

## 音频格式支持

服务端通过文件头自动检测音频格式，不依赖文件扩展名：

| 格式 | 文件头特征 | 常见扩展名 |
|------|-----------|-----------|
| WAV | `RIFF....WAVE` | .wav |
| MP3 | `ID3...` 或 `0xFF` | .mp3、.wav（误命名） |
| M4A | `....` (MP4) | .m4a |
| OGG | `OggS` | .ogg |
| FLAC | `fLaC` | .flac |

## 项目结构

```
.
├── client.py          # 客户端脚本
├── server.py          # 服务端脚本
├── requirements.txt   # Python 依赖
├── frontend/          # React 前端
│   ├── src/
│   │   ├── components/   # React 组件
│   │   ├── services/     # API 服务
│   │   └── app/           # 主应用
│   ├── package.json
│   └── vite.config.ts
├── ai_agent/          # AI Agent 服务
│   ├── ai_agent_server.py  # FastAPI 服务
│   ├── llm_engine.py    # 流式 Agent 逻辑
│   └── requirements.txt # AI Agent 依赖
├── LICENSE            # MIT 许可证
├── README.md          # 英文文档
├── README_zh.md       # 中文文档
└── examples/         # 示例音频文件
```

## 前端 (React 单页应用)

项目包含一个现代化的网页界面，位于 `frontend/` 目录。

### 功能特点

- **拖拽上传音频**：支持 WAV、MP3、M4A、OGG、FLAC
- **实时转录**：可视化的进度跟踪
- **AI 智能处理**：使用可自定义的系统提示词处理转录内容
- **深色/浅色模式**：支持主题切换
- **多种导出格式**：PDF、Markdown、TXT、JSON
- **历史记录管理**：浏览和重新处理过往的转录记录

### 快速开始

```bash
cd frontend
npm install
npm run dev
```

前端开发服务器运行在 `http://localhost:5173`，连接后端服务 `http://localhost:8765`。

### 技术栈

- React 18 + TypeScript
- Vite 构建工具
- TailwindCSS
- Radix UI 组件库
- jsPDF PDF 导出

## AI Agent 服务

`ai_agent/` 目录包含一个 FastAPI 服务，提供基于可自定义系统提示词的 AI 文本处理能力。

### 环境配置

```bash
cd ai_agent
pip install -r requirements.txt
```

### 启动服务

```bash
python ai_agent_server.py
```

AI Agent 服务运行在 `http://localhost:8766`。

### API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/ai-process` | POST | 使用提示词处理转录文本 |

### 请求格式

```json
{
  "transcription": "转录文本...",
  "prompt": "系统提示词内容...",
  "session_id": "可选会话ID"
}
```

### 系统架构

```
前端 (5173) → AI Agent 服务 (8766) → 大模型 (DeepSeek/Volcengine)
```

## 许可证

MIT License - 见 [LICENSE](LICENSE)
