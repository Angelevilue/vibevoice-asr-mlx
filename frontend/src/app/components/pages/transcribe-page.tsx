import { Upload, FileAudio, Settings, Loader2, Zap } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Progress } from '../ui/progress';
import { toast } from 'sonner';

interface TranscribePageProps {
  audioFile: File | null;
  timeout: number;
  isTranscribing: boolean;
  progress: number;
  isDragging: boolean;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onTimeoutChange: (value: number) => void;
  onTranscribe: () => void;
}

export function TranscribePage({
  audioFile,
  timeout,
  isTranscribing,
  progress,
  isDragging,
  onFileChange,
  onDragOver,
  onDragLeave,
  onDrop,
  onTimeoutChange,
  onTranscribe,
}: TranscribePageProps) {
  return (
    <div className="h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-4xl space-y-6">
        <div className="text-center space-y-3 mb-8">
          <div className="flex items-center justify-center gap-3">
            <Zap className="w-12 h-12 text-blue-500 dark:text-blue-400" />
            <h1 className="text-6xl tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
              音频转录
            </h1>
          </div>
          <p className="text-xl text-muted-foreground">上传音频文件，快速生成文本转录</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 上传区域 */}
          <Card className="border-2 backdrop-blur-sm bg-background/50 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-6 h-6 text-blue-500" />
                上传音频文件
              </CardTitle>
              <CardDescription className="text-base">支持 MP3、WAV、M4A 等格式</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`border-2 border-dashed rounded-lg p-12 text-center transition-all ${
                  isDragging
                    ? 'border-blue-500 bg-blue-500/10 scale-[1.02]'
                    : 'border-muted-foreground/30 hover:border-blue-400/50 hover:bg-blue-500/5'
                }`}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              >
                <div className="flex flex-col items-center gap-6">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
                    <FileAudio className="w-12 h-12 text-white" />
                  </div>
                  {audioFile ? (
                    <div className="space-y-3">
                      <p className="text-base">已选择文件:</p>
                      <p className="text-base text-blue-600 dark:text-blue-400">{audioFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(audioFile.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-base">拖拽音频文件到此处</p>
                      <p className="text-sm text-muted-foreground">或点击下方按钮选择文件</p>
                    </div>
                  )}
                  <label htmlFor="audio-upload">
                    <Button variant="outline" size="lg" className="cursor-pointer border-2" asChild>
                      <span>
                        <Upload className="w-5 h-5 mr-2" />
                        选择文件
                      </span>
                    </Button>
                  </label>
                  <input
                    id="audio-upload"
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={onFileChange}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 转录设置 */}
          <Card className="border-2 backdrop-blur-sm bg-background/50 shadow-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-6 h-6 text-purple-500" />
                转录设置
              </CardTitle>
              <CardDescription className="text-base">配置转录参数</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label htmlFor="timeout" className="text-base">转录超时时间（秒）</Label>
                <Input
                  id="timeout"
                  type="number"
                  min="1"
                  max="3600"
                  value={timeout}
                  onChange={(e) => onTimeoutChange(Number(e.target.value))}
                  disabled={isTranscribing}
                  className="border-2 h-12 text-base"
                />
                <p className="text-sm text-muted-foreground">
                  演示模式下实际使用 {timeout} 秒
                </p>
              </div>

              <Button
                className="w-full h-14 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 shadow-lg text-lg"
                size="lg"
                onClick={onTranscribe}
                disabled={!audioFile || isTranscribing}
              >
                {isTranscribing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    转录中...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 mr-2" />
                    开始转录
                  </>
                )}
              </Button>

              {isTranscribing && (
                <div className="space-y-3">
                  <Progress value={progress} className="h-3" />
                  <p className="text-base text-center text-muted-foreground">{progress}%</p>
                </div>
              )}

              {!isTranscribing && audioFile && (
                <div className="p-4 rounded-lg bg-green-500/10 border-2 border-green-500/30">
                  <p className="text-sm text-center text-green-600 dark:text-green-400">
                    ✓ 文件已准备就绪，点击开始转录
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
