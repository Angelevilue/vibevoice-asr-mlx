import { Upload, History, Brain, Sparkles, FileAudio } from 'lucide-react';
import { cn } from './ui/utils';

export type PageView = 'transcribe' | 'ai-process' | 'history' | 'prompts';

interface NavigationItem {
  id: PageView;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const navigationItems: NavigationItem[] = [
  {
    id: 'transcribe',
    label: '音频转录',
    icon: <FileAudio className="w-5 h-5" />,
    color: 'text-blue-500',
  },
  {
    id: 'ai-process',
    label: 'AI 处理',
    icon: <Sparkles className="w-5 h-5" />,
    color: 'text-yellow-500',
  },
  {
    id: 'prompts',
    label: '提示词管理',
    icon: <Brain className="w-5 h-5" />,
    color: 'text-purple-500',
  },
  {
    id: 'history',
    label: '历史记录',
    icon: <History className="w-5 h-5" />,
    color: 'text-green-500',
  },
];

interface NavigationSidebarProps {
  currentPage: PageView;
  onNavigate: (page: PageView) => void;
}

export function NavigationSidebar({ currentPage, onNavigate }: NavigationSidebarProps) {
  return (
    <div className="fixed left-0 top-0 h-full w-20 backdrop-blur-md bg-background/80 border-r-2 border-border shadow-2xl z-40 flex flex-col items-center py-8 gap-6">
      {/* Logo */}
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center shadow-lg mb-4">
        <Upload className="w-7 h-7 text-white" />
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 flex flex-col gap-4">
        {navigationItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={cn(
              'relative group w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300',
              currentPage === item.id
                ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-2 border-blue-500/50 shadow-lg scale-110'
                : 'hover:bg-muted/50 border-2 border-transparent hover:scale-105'
            )}
            title={item.label}
          >
            <div className={cn(currentPage === item.id ? item.color : 'text-muted-foreground')}>
              {item.icon}
            </div>
            
            {/* Active Indicator */}
            {currentPage === item.id && (
              <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-blue-500 to-purple-500 rounded-r-full" />
            )}

            {/* Tooltip */}
            <div className="absolute left-full ml-4 px-3 py-2 bg-popover border-2 border-border rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-xl">
              <p className="text-sm">{item.label}</p>
            </div>
          </button>
        ))}
      </nav>

      {/* Bottom Indicator */}
      <div className="flex flex-col items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <p className="text-xs text-muted-foreground">在线</p>
      </div>
    </div>
  );
}
