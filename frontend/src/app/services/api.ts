const API_BASE_URL = 'http://localhost:8765';

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
