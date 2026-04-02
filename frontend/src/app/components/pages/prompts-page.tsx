import { Brain, Plus, Trash2, Edit2, Check, X, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { ScrollArea } from '../ui/scroll-area';
import { SystemPrompt } from '../prompt-manager';
import { toast } from 'sonner';

interface PromptsPageProps {
  prompts: SystemPrompt[];
  selectedPromptId?: string;
  onAdd: (prompt: Omit<SystemPrompt, 'id'>) => void;
  onUpdate: (id: string, prompt: Partial<SystemPrompt>) => void;
  onDelete: (id: string) => void;
  onSelect: (prompt: SystemPrompt) => void;
}

export function PromptsPage({
  prompts,
  selectedPromptId,
  onAdd,
  onUpdate,
  onDelete,
  onSelect,
}: PromptsPageProps) {
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
    <div className="h-screen flex items-start justify-center pt-24 px-8">
      <div className="w-full max-w-6xl space-y-6">
        <div className="text-center space-y-3 mb-8">
          <div className="flex items-center justify-center gap-3">
            <Brain className="w-12 h-12 text-purple-500 dark:text-purple-400" />
            <h1 className="text-6xl tracking-tight bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
              提示词管理
            </h1>
          </div>
          <p className="text-xl text-muted-foreground">管理 AI 处理的系统提示词</p>
        </div>

        <Card className="border-2 backdrop-blur-sm bg-background/50 shadow-2xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">系统提示词库</CardTitle>
                <CardDescription className="text-base mt-2">
                  {selectedPromptId 
                    ? `当前选择: ${prompts.find(p => p.id === selectedPromptId)?.name}` 
                    : '请选择一个提示词用于 AI 处理'}
                </CardDescription>
              </div>
              <Button
                size="lg"
                onClick={() => setIsAdding(true)}
                disabled={isAdding}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0 shadow-lg"
              >
                <Plus className="w-5 h-5 mr-2" />
                添加提示词
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] pr-4">
              <div className="space-y-4">
                {/* 添加新提示词表单 */}
                {isAdding && (
                  <Card className="border-2 border-purple-500/50 bg-purple-500/5 shadow-lg">
                    <CardHeader>
                      <CardTitle className="text-lg">新建提示词</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="new-prompt-name" className="text-base">提示词名称</Label>
                        <Input
                          id="new-prompt-name"
                          placeholder="例如: 会议记录整理"
                          value={newPromptName}
                          onChange={(e) => setNewPromptName(e.target.value)}
                          className="border-2 h-12"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-prompt-content" className="text-base">提示词内容</Label>
                        <Textarea
                          id="new-prompt-content"
                          placeholder="请输入系统提示词内容..."
                          value={newPromptContent}
                          onChange={(e) => setNewPromptContent(e.target.value)}
                          className="min-h-[150px] resize-none border-2"
                        />
                      </div>
                      <div className="flex gap-3">
                        <Button size="lg" onClick={handleAdd} className="flex-1">
                          <Check className="w-5 h-5 mr-2" />
                          保存
                        </Button>
                        <Button size="lg" variant="outline" onClick={handleCancelAdd} className="flex-1 border-2">
                          <X className="w-5 h-5 mr-2" />
                          取消
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 提示词列表 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {prompts.map((prompt) => (
                    <Card
                      key={prompt.id}
                      className={`border-2 transition-all ${
                        selectedPromptId === prompt.id
                          ? 'border-purple-500 bg-purple-500/10 shadow-lg'
                          : 'hover:border-purple-500/50 hover:shadow-md'
                      }`}
                    >
                      {editingId === prompt.id ? (
                        // 编辑模式
                        <CardContent className="pt-6">
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-base">提示词名称</Label>
                              <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="border-2 h-12"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-base">提示词内容</Label>
                              <Textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="min-h-[150px] resize-none border-2"
                              />
                            </div>
                            <div className="flex gap-3">
                              <Button size="lg" onClick={() => handleUpdate(prompt.id)} className="flex-1">
                                <Check className="w-5 h-5 mr-2" />
                                保存
                              </Button>
                              <Button size="lg" variant="outline" onClick={handleCancelEdit} className="flex-1 border-2">
                                <X className="w-5 h-5 mr-2" />
                                取消
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      ) : (
                        // 显示模式
                        <>
                          <CardHeader>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <CardTitle className="text-lg">{prompt.name}</CardTitle>
                                  {prompt.isDefault && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-500 border border-blue-500/30">
                                      默认
                                    </span>
                                  )}
                                  {selectedPromptId === prompt.id && (
                                    <Sparkles className="w-4 h-4 text-purple-500" />
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(prompt)}
                                  title="编辑"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => onDelete(prompt.id)}
                                  disabled={prompt.isDefault}
                                  title={prompt.isDefault ? '默认提示词不可删除' : '删除'}
                                >
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground mb-4 line-clamp-4">
                              {prompt.content}
                            </p>
                            <Button
                              size="lg"
                              variant={selectedPromptId === prompt.id ? 'default' : 'outline'}
                              className={`w-full border-2 ${
                                selectedPromptId === prompt.id
                                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white'
                                  : ''
                              }`}
                              onClick={() => onSelect(prompt)}
                            >
                              {selectedPromptId === prompt.id ? (
                                <>
                                  <Check className="w-5 h-5 mr-2" />
                                  已选择
                                </>
                              ) : (
                                '选择此提示词'
                              )}
                            </Button>
                          </CardContent>
                        </>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
