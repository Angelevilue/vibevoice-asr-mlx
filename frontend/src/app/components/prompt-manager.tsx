import { useState } from 'react';
import { Brain, Plus, Trash2, Edit2, Check, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { ScrollArea } from './ui/scroll-area';
import { toast } from 'sonner';

export interface SystemPrompt {
  id: string;
  name: string;
  content: string;
  isDefault?: boolean;
}

interface PromptManagerProps {
  prompts: SystemPrompt[];
  onAdd: (prompt: Omit<SystemPrompt, 'id'>) => void;
  onUpdate: (id: string, prompt: Partial<SystemPrompt>) => void;
  onDelete: (id: string) => void;
  onSelect: (prompt: SystemPrompt) => void;
  selectedPromptId?: string;
}

export function PromptManager({
  prompts,
  onAdd,
  onUpdate,
  onDelete,
  onSelect,
  selectedPromptId,
}: PromptManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newPromptName, setNewPromptName] = useState('');
  const [newPromptContent, setNewPromptContent] = useState('');
  const [editName, setEditName] = useState('');
  const [editContent, setEditContent] = useState('');

  const handleAdd = () => {
    if (!newPromptName.trim() || !newPromptContent.trim()) {
      toast.error('请填写提示词名称和内容');
      return;
    }
    onAdd({
      name: newPromptName,
      content: newPromptContent,
    });
    setNewPromptName('');
    setNewPromptContent('');
    setIsAdding(false);
    toast.success('提示词已添加');
  };

  const handleEdit = (prompt: SystemPrompt) => {
    setEditingId(prompt.id);
    setEditName(prompt.name);
    setEditContent(prompt.content);
  };

  const handleUpdate = (id: string) => {
    if (!editName.trim() || !editContent.trim()) {
      toast.error('请填写提示词名称和内容');
      return;
    }
    onUpdate(id, {
      name: editName,
      content: editContent,
    });
    setEditingId(null);
    toast.success('提示词已更新');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setEditContent('');
  };

  const handleCancelAdd = () => {
    setIsAdding(false);
    setNewPromptName('');
    setNewPromptContent('');
  };

  return (
    <Card className="border-2 backdrop-blur-sm bg-background/50 shadow-lg hover:shadow-xl transition-shadow h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-500" />
              系统提示词
            </CardTitle>
            <CardDescription>管理 AI 处理提示词</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAdding(true)}
            disabled={isAdding}
          >
            <Plus className="w-4 h-4 mr-1" />
            添加
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-3">
            {/* 添加新提示词表单 */}
            {isAdding && (
              <div className="p-4 rounded-lg border-2 border-purple-500/50 bg-purple-500/5 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="new-prompt-name">提示词名称</Label>
                  <Input
                    id="new-prompt-name"
                    placeholder="例如: 会议记录整理"
                    value={newPromptName}
                    onChange={(e) => setNewPromptName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-prompt-content">提示词内容</Label>
                  <Textarea
                    id="new-prompt-content"
                    placeholder="请输入系统提示词内容..."
                    value={newPromptContent}
                    onChange={(e) => setNewPromptContent(e.target.value)}
                    className="min-h-[100px] resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAdd} className="flex-1">
                    <Check className="w-4 h-4 mr-1" />
                    保存
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancelAdd} className="flex-1">
                    <X className="w-4 h-4 mr-1" />
                    取消
                  </Button>
                </div>
              </div>
            )}

            {/* 提示词列表 */}
            {prompts.map((prompt) => (
              <div
                key={prompt.id}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedPromptId === prompt.id
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-muted hover:border-purple-500/50 hover:bg-purple-500/5'
                }`}
              >
                {editingId === prompt.id ? (
                  // 编辑模式
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>提示词名称</Label>
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>提示词内容</Label>
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[100px] resize-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleUpdate(prompt.id)} className="flex-1">
                        <Check className="w-4 h-4 mr-1" />
                        保存
                      </Button>
                      <Button size="sm" variant="outline" onClick={handleCancelEdit} className="flex-1">
                        <X className="w-4 h-4 mr-1" />
                        取消
                      </Button>
                    </div>
                  </div>
                ) : (
                  // 显示模式
                  <>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm">{prompt.name}</p>
                          {prompt.isDefault && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-500">
                              默认
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {prompt.content}
                        </p>
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(prompt)}
                          disabled={prompt.isDefault}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onDelete(prompt.id)}
                          disabled={prompt.isDefault}
                        >
                          <Trash2 className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={selectedPromptId === prompt.id ? 'default' : 'outline'}
                      className="w-full"
                      onClick={() => onSelect(prompt)}
                    >
                      {selectedPromptId === prompt.id ? '已选择' : '选择此提示词'}
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
