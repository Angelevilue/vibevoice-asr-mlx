import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { ThemeToggle } from './theme-toggle';
import { NavigationSidebar, PageView } from './navigation-sidebar';
import { TranscribePage } from './pages/transcribe-page';
import { AIProcessPage } from './pages/ai-process-page';
import { HistoryPage } from './pages/history-page';
import { PromptsPage } from './pages/prompts-page';
import { HistoryItem } from './history-panel';
import { SystemPrompt } from './prompt-manager';
import { transcribeAudio, checkServerHealth, processWithAI, checkAIAgentHealth } from '../services/api';

// 默认系统提示词
const DEFAULT_PROMPTS: SystemPrompt[] = [
  {
    id: 'extract-keywords',
    name: '提取关键信息',
    content: '请从以下转录文本中提取关键信息，包括重要的人名、地名、时间、事件和数字。请以简洁的列表形式呈现。',
    isDefault: true,
  },
  {
    id: 'summarize',
    name: '总结转录内容',
    content: '请对以下转录文本进行总结，用3-5句话概括主要内容。请使用简洁、专业的语言。',
    isDefault: true,
  },
  {
    id: 'meeting-notes',
    name: '会议记录整理',
    content: '请将以下转录文本整理成规范的会议记录格式，包括：会议主题、参与人员、讨论要点、决议事项和待办事项。',
    isDefault: true,
  },
];

export function AudioTranscription() {
  const [currentPage, setCurrentPage] = useState<PageView>('transcribe');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [timeout, setTimeout] = useState<number>(1800);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [transcriptionText, setTranscriptionText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [prompts, setPrompts] = useState<SystemPrompt[]>(DEFAULT_PROMPTS);
  const [selectedPrompt, setSelectedPrompt] = useState<SystemPrompt | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);

  // 从 localStorage 加载历史记录和自定义提示词
  useEffect(() => {
    const savedHistory = localStorage.getItem('transcription-history');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }

    const savedPrompts = localStorage.getItem('custom-prompts');
    if (savedPrompts) {
      const customPrompts = JSON.parse(savedPrompts);
      setPrompts([...DEFAULT_PROMPTS, ...customPrompts]);
    }
  }, []);

  // 保存历史记录到 localStorage
  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('transcription-history', JSON.stringify(history));
    }
  }, [history]);

  // 保存自定义提示词到 localStorage
  useEffect(() => {
    const customPrompts = prompts.filter((p) => !p.isDefault);
    if (customPrompts.length > 0) {
      localStorage.setItem('custom-prompts', JSON.stringify(customPrompts));
    }
  }, [prompts]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFile = (file: File) => {
    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/m4a', 'audio/ogg', 'audio/webm'];
    if (!file.type.startsWith('audio/') && !validTypes.includes(file.type)) {
      toast.error('请上传有效的音频文件');
      return;
    }
    
    setAudioFile(file);
    setTranscriptionText('');
    setAiResult('');
    setCurrentHistoryId(null);
    toast.success(`文件 "${file.name}" 已上传`);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }, []);

  const handleTranscribe = async () => {
    if (!audioFile) {
      toast.error('请先上传音频文件');
      return;
    }

    // 检查服务器连接
    const isHealthy = await checkServerHealth();
    if (!isHealthy) {
      toast.error('无法连接到服务器，请确保服务器已启动');
      return;
    }

    setIsTranscribing(true);
    setProgress(0);
    setTranscriptionText('');
    setAiResult('');

    // 模拟进度（因为服务器不支持实时进度推送）
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        return prev + Math.random() * 15;
      });
    }, 1000);

    try {
      const result = await transcribeAudio(audioFile, 'json', timeout, (status) => {
        // 可以在这里更新状态
      });

      clearInterval(interval);
      setProgress(100);
      setTranscriptionText(result.text);
      setIsTranscribing(false);
      toast.success('转录完成！可前往 AI 处理页面查看');

      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        fileName: audioFile.name,
        transcription: result.text,
        timestamp: Date.now(),
      };
      setHistory((prev) => [newHistoryItem, ...prev]);
      setCurrentHistoryId(newHistoryItem.id);

      // 自动跳转到 AI 处理页面
      setTimeout(() => {
        setCurrentPage('ai-process');
      }, 1000);
    } catch (error) {
      clearInterval(interval);
      setIsTranscribing(false);
      setProgress(0);
      toast.error(error instanceof Error ? error.message : '转录失败');
    }
  };

  const handleAIProcess = async () => {
    if (!transcriptionText) {
      toast.error('请先完成转录');
      return;
    }

    if (!selectedPrompt) {
      toast.error('请先选择一个系统提示词');
      return;
    }

    // 检查 AI 服务连接
    const isHealthy = await checkAIAgentHealth();
    if (!isHealthy) {
      toast.error('无法连接到 AI 服务，请确保 AI Agent 服务已启动');
      return;
    }

    setIsProcessing(true);
    setAiResult('');

    try {
      const response = await processWithAI(
        transcriptionText,
        selectedPrompt.content,
        currentHistoryId || 'default'
      );

      setAiResult(response.result);
      setIsProcessing(false);
      toast.success('AI 处理完成！');

      if (currentHistoryId && selectedPrompt.id === 'summarize') {
        setHistory((prev) =>
          prev.map((item) =>
            item.id === currentHistoryId
              ? { ...item, summary: response.result }
              : item
          )
        );
      }
    } catch (error) {
      setIsProcessing(false);
      toast.error(error instanceof Error ? error.message : 'AI 处理失败');
    }
  };

  const downloadAsText = () => {
    const content = aiResult ? `${transcriptionText}\n\n--- AI 处理结果 ---\n\n${aiResult}` : transcriptionText;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transcription_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('TXT 文件已下载');
  };

  const downloadAsMarkdown = () => {
    const content = aiResult ? `${transcriptionText}\n\n---\n\n## AI 处理结果\n\n${aiResult}` : transcriptionText;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transcription_${Date.now()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Markdown 文件已下载');
  };

  const downloadAsJSON = () => {
    const jsonData = {
      fileName: audioFile?.name,
      fileSize: audioFile?.size,
      transcriptionDate: new Date().toISOString(),
      timeoutSetting: timeout,
      transcription: transcriptionText,
      aiResult: aiResult || null,
      selectedPrompt: selectedPrompt?.name || null,
    };
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transcription_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('JSON 文件已下载');
  };

  const downloadAsPDF = () => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;
    
    pdf.setFontSize(12);
    
    const content = aiResult ? `${transcriptionText}\n\n--- AI 处理结果 ---\n\n${aiResult}` : transcriptionText;
    const lines = pdf.splitTextToSize(content, maxWidth);
    
    let y = margin;
    lines.forEach((line: string) => {
      if (y > pageHeight - margin) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin, y);
      y += 7;
    });
    
    pdf.save(`transcription_${Date.now()}.pdf`);
    toast.success('PDF 文件已下载');
  };

  const handleSelectHistory = (item: HistoryItem) => {
    setTranscriptionText(item.transcription);
    setCurrentHistoryId(item.id);
    setAiResult('');
    setCurrentPage('ai-process');
  };

  const handleDeleteHistory = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
    if (currentHistoryId === id) {
      setCurrentHistoryId(null);
    }
    toast.success('历史记录已删除');
  };

  const handleClearHistory = () => {
    setHistory([]);
    setCurrentHistoryId(null);
    localStorage.removeItem('transcription-history');
    toast.success('历史记录已清空');
  };

  const handleAddPrompt = (prompt: Omit<SystemPrompt, 'id'>) => {
    const newPrompt: SystemPrompt = {
      ...prompt,
      id: Date.now().toString(),
    };
    setPrompts((prev) => [...prev, newPrompt]);
  };

  const handleUpdatePrompt = (id: string, updates: Partial<SystemPrompt>) => {
    setPrompts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const handleDeletePrompt = (id: string) => {
    setPrompts((prev) => prev.filter((p) => p.id !== id));
    if (selectedPrompt?.id === id) {
      setSelectedPrompt(null);
    }
    toast.success('提示词已删除');
  };

  const handleSelectPrompt = (prompt: SystemPrompt) => {
    setSelectedPrompt(prompt);
    toast.success(`已选择提示词: ${prompt.name}`);
  };

  return (
    <div className="min-h-screen relative">
      {/* 右上角主题切换按钮 */}
      <div className="fixed top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* 左侧导航栏 */}
      <NavigationSidebar currentPage={currentPage} onNavigate={setCurrentPage} />

      {/* 主内容区域 - 左侧留出导航栏空间 */}
      <div className="ml-20">
        {currentPage === 'transcribe' && (
          <TranscribePage
            audioFile={audioFile}
            timeout={timeout}
            isTranscribing={isTranscribing}
            progress={progress}
            isDragging={isDragging}
            onFileChange={handleFileChange}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onTimeoutChange={setTimeout}
            onTranscribe={handleTranscribe}
          />
        )}

        {currentPage === 'ai-process' && (
          <AIProcessPage
            transcriptionText={transcriptionText}
            aiResult={aiResult}
            selectedPrompt={selectedPrompt}
            isProcessing={isProcessing}
            onTranscriptionChange={setTranscriptionText}
            onAIResultChange={setAiResult}
            onProcess={handleAIProcess}
            onDownloadPDF={downloadAsPDF}
            onDownloadMarkdown={downloadAsMarkdown}
            onDownloadText={downloadAsText}
            onDownloadJSON={downloadAsJSON}
          />
        )}

        {currentPage === 'prompts' && (
          <PromptsPage
            prompts={prompts}
            selectedPromptId={selectedPrompt?.id}
            onAdd={handleAddPrompt}
            onUpdate={handleUpdatePrompt}
            onDelete={handleDeletePrompt}
            onSelect={handleSelectPrompt}
          />
        )}

        {currentPage === 'history' && (
          <HistoryPage
            history={history}
            onSelect={handleSelectHistory}
            onDelete={handleDeleteHistory}
            onClear={handleClearHistory}
          />
        )}
      </div>
    </div>
  );
}
