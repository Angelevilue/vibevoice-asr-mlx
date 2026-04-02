import { Sparkles, Loader2, Download, Copy, Eye, Edit3 } from 'lucide-react';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { SystemPrompt } from '../prompt-manager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

interface AIProcessPageProps {
  transcriptionText: string;
  aiResult: string;
  selectedPrompt: SystemPrompt | null;
  isProcessing: boolean;
  onTranscriptionChange: (value: string) => void;
  onAIResultChange: (value: string) => void;
  onProcess: () => void;
  onDownloadPDF: () => void;
  onDownloadMarkdown: () => void;
  onDownloadText: () => void;
  onDownloadJSON: () => void;
}

export function AIProcessPage({
  transcriptionText,
  aiResult,
  selectedPrompt,
  isProcessing,
  onTranscriptionChange,
  onAIResultChange,
  onProcess,
  onDownloadPDF,
  onDownloadMarkdown,
  onDownloadText,
  onDownloadJSON,
}: AIProcessPageProps) {
  const [aiViewMode, setAiViewMode] = useState<'preview' | 'edit'>('preview');

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${type}已复制到剪贴板`);
  };

  return (
    <div className="h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-7xl space-y-6">
        <div className="text-center space-y-3 mb-8">
          <div className="flex items-center justify-center gap-3">
            <Sparkles className="w-12 h-12 text-yellow-500 dark:text-yellow-400" />
            <h1 className="text-6xl tracking-tight bg-gradient-to-r from-yellow-600 to-orange-600 dark:from-yellow-400 dark:to-orange-400 bg-clip-text text-transparent">
              AI 智能处理
            </h1>
          </div>
          <p className="text-xl text-muted-foreground">
            {selectedPrompt ? `当前提示词: ${selectedPrompt.name}` : '请先在"提示词管理"页面选择提示词'}
          </p>
        </div>

        {!transcriptionText ? (
          <Card className="border-2 backdrop-blur-sm bg-background/50 shadow-2xl">
            <CardContent className="py-20 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
                  <Sparkles className="w-10 h-10 text-muted-foreground" />
                </div>
                <p className="text-lg text-muted-foreground">请先在"音频转录"页面完成转录</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-200px)]">
            {/* 转录文本 */}
            <Card className="border-2 backdrop-blur-sm bg-background/50 shadow-2xl flex flex-col min-h-0">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
                      转录文本
                    </CardTitle>
                    <CardDescription className="text-base mt-2">可编辑原始转录内容</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(transcriptionText, '转录文本')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto border-2 border-input rounded-lg min-h-0">
                  <Textarea
                    value={transcriptionText}
                    onChange={(e) => onTranscriptionChange(e.target.value)}
                    className="w-full h-full resize-none border-0 font-mono text-sm bg-transparent"
                    style={{ minHeight: '100%' }}
                  />
                </div>
                
                <div className="mt-6">
                  <Button
                    className="w-full h-14 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white border-0 shadow-lg text-lg"
                    size="lg"
                    onClick={onProcess}
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        AI 处理中...
                      </>
                    ) : !selectedPrompt ? (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        请先选择提示词
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        开始 AI 处理
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* AI 处理结果 */}
            <Card className="border-2 backdrop-blur-sm bg-background/50 shadow-2xl flex flex-col min-h-0">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse"></div>
                      AI 处理结果
                    </CardTitle>
                    <CardDescription className="text-base mt-2">
                      {aiResult ? 'AI 处理完成，可编辑结果' : '等待 AI 处理...'}
                    </CardDescription>
                  </div>
                  {aiResult && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAiViewMode('preview')}
                        className={aiViewMode === 'preview' ? 'bg-yellow-500/20' : ''}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        预览
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAiViewMode('edit')}
                        className={aiViewMode === 'edit' ? 'bg-yellow-500/20' : ''}
                      >
                        <Edit3 className="w-4 h-4 mr-1" />
                        编辑
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(aiResult, 'AI 处理结果')}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {aiViewMode === 'preview' ? (
                  <div className="flex-1 overflow-y-auto border-2 border-yellow-500/30 bg-yellow-500/5 rounded-lg min-h-0 p-4">
                    {aiResult ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{aiResult}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">AI 处理结果将显示在这里...</p>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto border-2 border-yellow-500/30 bg-yellow-500/5 rounded-lg min-h-0">
                    <Textarea
                      value={aiResult}
                      onChange={(e) => onAIResultChange(e.target.value)}
                      placeholder="AI 处理结果将显示在这里..."
                      className="w-full h-full resize-none border-0 bg-transparent font-mono text-sm"
                      style={{ minHeight: '100%' }}
                    />
                  </div>
                )}

                {aiResult && (
                  <div className="mt-6">
                    <Label className="mb-3 block text-base">下载为:</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <Button 
                        variant="outline"
                        size="lg"
                        onClick={onDownloadPDF} 
                        className="border-2 hover:border-red-500 hover:text-red-500 transition-colors"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        PDF
                      </Button>
                      <Button 
                        variant="outline"
                        size="lg"
                        onClick={onDownloadMarkdown} 
                        className="border-2 hover:border-blue-500 hover:text-blue-500 transition-colors"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Markdown
                      </Button>
                      <Button 
                        variant="outline"
                        size="lg"
                        onClick={onDownloadText} 
                        className="border-2 hover:border-green-500 hover:text-green-500 transition-colors"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        TXT
                      </Button>
                      <Button 
                        variant="outline"
                        size="lg"
                        onClick={onDownloadJSON} 
                        className="border-2 hover:border-purple-500 hover:text-purple-500 transition-colors"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        JSON
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
