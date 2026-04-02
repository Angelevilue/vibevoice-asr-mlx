import { Clock, Trash2, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { toast } from 'sonner';

export interface HistoryItem {
  id: string;
  fileName: string;
  transcription: string;
  timestamp: number;
  summary?: string;
}

interface HistoryPanelProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

export function HistoryPanel({ history, onSelect, onDelete, onClear }: HistoryPanelProps) {
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

  return (
    <Card className="border-2 backdrop-blur-sm bg-background/50 shadow-lg hover:shadow-xl transition-shadow h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-green-500" />
              历史记录
            </CardTitle>
            <CardDescription>共 {history.length} 条记录</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadHistory}
              disabled={history.length === 0}
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onClear}
              disabled={history.length === 0}
            >
              清空
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          {history.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p className="text-sm">暂无历史记录</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-lg border-2 border-muted hover:border-blue-500/50 hover:bg-blue-500/5 transition-all cursor-pointer group"
                  onClick={() => onSelect(item)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate mb-1">{item.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.timestamp).toLocaleString('zh-CN')}
                      </p>
                      {item.summary && (
                        <p className="text-xs text-blue-500 dark:text-blue-400 mt-2 line-clamp-2">
                          摘要: {item.summary}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(item.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
