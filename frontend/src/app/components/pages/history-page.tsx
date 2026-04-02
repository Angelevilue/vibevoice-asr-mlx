import { History, Trash2, Download, FileText, Calendar, Check } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { HistoryItem } from '../history-panel';
import { toast } from 'sonner';

interface HistoryPageProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

export function HistoryPage({ history, onSelect, onDelete, onClear }: HistoryPageProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === history.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(history.map((item) => item.id)));
    }
  };

  const exportSelected = () => {
    if (selectedIds.size === 0) {
      toast.error('请先选择要导出的记录');
      return;
    }

    const selectedItems = history.filter((item) => selectedIds.has(item.id));
    const content = selectedItems
      .map((item) => `文件: ${item.fileName}\n时间: ${new Date(item.timestamp).toLocaleString('zh-CN')}\n\n转录内容:\n${item.transcription}${item.summary ? `\n\n摘要:\n${item.summary}` : ''}`)
      .join('\n\n' + '='.repeat(50) + '\n\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `history_export_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${selectedIds.size} 条记录`);
  };

  const downloadHistory = () => {
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `history_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('历史记录已导出');
  };

  const handleCardClick = (item: HistoryItem) => {
    if (selectedIds.size > 0) {
      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(item.id)) {
          newSet.delete(item.id);
        } else {
          newSet.add(item.id);
        }
        return newSet;
      });
    } else {
      onSelect(item);
      toast.success('已加载历史记录，请前往 AI 处理页面查看');
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center pt-16 px-8 pb-4 overflow-hidden">
      <div className="w-full max-w-6xl flex flex-col h-full">
        <div className="text-center space-y-2 mb-2 flex-shrink-0">
          <div className="flex items-center justify-center gap-3">
            <History className="w-10 h-10 text-green-500 dark:text-green-400" />
            <h1 className="text-5xl tracking-tight bg-gradient-to-r from-green-600 to-emerald-600 dark:from-green-400 dark:to-emerald-400 bg-clip-text text-transparent">
              历史记录
            </h1>
          </div>
          <p className="text-lg text-muted-foreground">管理和查看转录历史</p>
        </div>

        <Card className="border-2 backdrop-blur-sm bg-background/50 shadow-2xl flex-1 min-h-0 overflow-hidden flex flex-col">
          <CardHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl">所有转录记录</CardTitle>
                <CardDescription className="text-sm mt-1">
                  共 {history.length} 条记录 {selectedIds.size > 0 && `| 已选择 ${selectedIds.size} 条`}
                </CardDescription>
              </div>
              <div className="flex gap-3">
                {selectedIds.size > 0 && (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={exportSelected}
                    className="border-2 border-green-500 hover:bg-green-500/10"
                  >
                    <Check className="w-5 h-5 mr-2" />
                    导出选中
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="lg"
                  onClick={downloadHistory}
                  disabled={history.length === 0}
                  className="border-2"
                >
                  <Download className="w-5 h-5 mr-2" />
                  导出全部
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={onClear}
                  disabled={history.length === 0}
                  className="border-2 hover:border-red-500 hover:text-red-500"
                >
                  <Trash2 className="w-5 h-5 mr-2" />
                  清空全部
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-hidden">
            {history.length === 0 ? (
              <div className="text-center py-20">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center">
                    <History className="w-10 h-10 text-muted-foreground" />
                  </div>
                  <p className="text-lg text-muted-foreground">暂无历史记录</p>
                  <p className="text-sm text-muted-foreground">完成转录后，记录将自动保存在这里</p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-full pr-4">
                <div className="mb-4 flex items-center gap-3">
                  <Checkbox
                    checked={selectedIds.size === history.length && history.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span className="text-sm">全选</span>
                  {selectedIds.size > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
                      取消选择
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {history.map((item) => (
                    <Card
                      key={item.id}
                      className={`border-2 hover:border-green-500/50 hover:shadow-lg transition-all cursor-pointer group ${
                        selectedIds.has(item.id) ? 'border-green-500 bg-green-500/10' : ''
                      }`}
                      onClick={() => handleCardClick(item)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedIds.has(item.id)}
                              onCheckedChange={() => {}}
                              onClick={(e) => toggleSelect(item.id, e as unknown as React.MouseEvent)}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <FileText className="w-4 h-4 text-green-500 flex-shrink-0" />
                              <CardTitle className="text-sm truncate">{item.fileName}</CardTitle>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              <span>{new Date(item.timestamp).toLocaleString('zh-CN')}</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(item.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground line-clamp-3">
                            {item.transcription}
                          </p>
                          {item.summary && (
                            <div className="pt-2 border-t border-border">
                              <p className="text-xs text-green-500 dark:text-green-400 line-clamp-2">
                                <span className="font-medium">摘要: </span>
                                {item.summary}
                              </p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
