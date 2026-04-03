# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

VibeVoice-ASR-4bit is a client-server speech recognition system optimized for Apple Silicon (MLX). The server loads the MLX model once and serves multiple transcription requests.

## Commands

```bash
# Start the ASR server (model loads on startup, ~6GB memory)
python server.py

# Start AI Agent service
cd ai_agent && python ai_agent_server.py

# Start frontend (React SPA)
cd frontend && npm install && npm run dev

# Client usage
python client.py <audio_file>                    # Default JSON format with timestamps
python client.py audio.wav -f txt                 # Plain text output
python client.py audio.wav -o result.txt          # Save to file
python client.py audio.wav -t 7200                # 2hr timeout for long audio

# Health checks
curl http://localhost:8765/health   # ASR server
curl http://localhost:8766/health   # AI Agent
```

## Architecture

**Server** (`server.py`):
- Loads MLX model at startup via `mlx_audio.stt.utils.load_model()`
- Uses Python's built-in `HTTPServer` for HTTP handling
- Handles POST requests at `/transcribe` endpoint
- Streams `generate_transcription()` verbose output to console for progress tracking
- Returns timing info via HTTP headers (`X-Text-Length`, `X-Audio-Duration`, `X-Processing-Time`)

**Client** (`client.py`):
- Sends audio file as binary POST to server
- Auto-detects MIME type via `mimetypes.guess_type()`
- Parses response headers for timing information
- Formats output based on `--format` flag (json/txt/srt/vtt)

**Frontend** (`frontend/`):
- React 18 + TypeScript + Vite SPA
- Connects to server at `http://localhost:8765`
- Supports drag & drop audio upload, real-time transcription, AI processing
- Model settings modal for configuring AI providers (Doubao, Qwen, DeepSeek)
- Export: PDF, Markdown, TXT, JSON
- Runs on `http://localhost:5173`

**AI Agent Service** (`ai_agent/`):
- FastAPI server on port 8766
- Streaming agent with configurable LLM providers
- Supports: Doubao, Qwen, DeepSeek (via API)
- Request format: `{ transcription, prompt, provider, model, apiKey, baseUrl, temperature, maxTokens }`

**Audio Format Detection**:
- Server detects format by file header bytes, not extension
- Supports: WAV (RIFF), MP3 (ID3/0xFF), M4A (MP4), OGG (OggS), FLAC (fLaC)
- Handles misnamed files (e.g., WAV saved as .mp3)

## Dependencies

- `mlx-audio==0.4.2` - MLX-based ASR model
- `numpy>=2.0.0`
- `requests>=2.31.0`

## Model Path

Default: `/Users/zephyrmuse/LLMs/model_weights/VibeVoice-ASR-4bit`

Override via environment variable: `VIBEVOICE_MODEL_PATH=/path/to/model`

## API

**ASR Server (port 8765)**
- `POST /transcribe` - Body: Raw audio binary, Headers: `X-Format` (txt/json/srt/vtt), Response: Transcription text
- `GET /health` - Response: `OK`

**AI Agent Server (port 8766)**
- `POST /ai-process` - Body: `{ transcription, prompt, provider, model, apiKey, baseUrl, temperature, maxTokens }`
- `GET /health` - Response: `OK`

## Notes

- Server must be restarted after code changes
- Long audio (>10min) may require increased timeout (`-t` flag)
- `result.segments` may be empty for some audio; always check length before accessing index 0
- Frontend stores model config, prompts, and history in localStorage
