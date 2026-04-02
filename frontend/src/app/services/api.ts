const API_BASE_URL = 'http://localhost:8765';
const AI_AGENT_URL = 'http://localhost:8766';

export interface TranscriptionResponse {
  text: string;
  textLength: number;
  audioDuration: number;
  processingTime: number;
}

export async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function transcribeAudio(
  audioFile: File,
  format: string = 'json',
  timeout: number = 3600,
  onProgress?: (status: string) => void
): Promise<TranscriptionResponse> {
  onProgress?.('正在连接服务器...');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);

  try {
    onProgress?.('正在上传音频文件...');

    const response = await fetch(`${API_BASE_URL}/transcribe`, {
      method: 'POST',
      headers: {
        'X-Format': format,
        'Content-Type': audioFile.type || 'audio/mpeg',
      },
      body: audioFile,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`服务器错误: ${response.status}`);
    }

    onProgress?.('正在转录中...');

    const text = await response.text();
    const textLength = response.headers.get('X-Text-Length') || '0';
    const audioDuration = response.headers.get('X-Audio-Duration') || '0';
    const processingTime = response.headers.get('X-Processing-Time') || '0';

    return {
      text,
      textLength: parseInt(textLength, 10),
      audioDuration: parseFloat(audioDuration),
      processingTime: parseFloat(processingTime),
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('请求超时，请增加超时时间');
    }
    throw error;
  }
}

export interface AIProcessResponse {
  result: string;
  session_id: string;
}

export async function checkAIAgentHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${AI_AGENT_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export async function processWithAI(
  transcription: string,
  prompt: string,
  sessionId: string = 'default',
  onProgress?: (status: string) => void
): Promise<AIProcessResponse> {
  onProgress?.('正在连接 AI 服务...');

  try {
    const response = await fetch(`${AI_AGENT_URL}/ai-process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcription,
        prompt,
        session_id: sessionId,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI 服务错误: ${response.status}`);
    }

    onProgress?.('AI 处理中...');

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    onProgress?.('处理完成');
    return data;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('AI 处理超时');
    }
    throw error;
  }
}
