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
├── LICENSE            # MIT 许可证
├── README.md          # 英文文档
├── README_zh.md       # 中文文档
└── examples/         # 示例音频文件
```

## 许可证

MIT License - 见 [LICENSE](LICENSE)
