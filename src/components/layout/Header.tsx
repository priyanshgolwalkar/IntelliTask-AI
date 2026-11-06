import { Plus, RefreshCw, Server, Sun, Moon } from 'lucide-react';
import { NavigationPage } from '../../types';

interface HeaderProps {
  currentPage: NavigationPage;
  onNavigate: (page: NavigationPage) => void;
  onQuickAddTask: () => void;
  onTestConnection: () => void;
  isCheckingConnection: boolean;
  fastApiConnected: boolean;
  geminiConfigured: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export function Header({
  currentPage,
  onNavigate,
  onQuickAddTask,
  onTestConnection,
  isCheckingConnection,
  fastApiConnected,
  theme,
  onToggleTheme,
}: HeaderProps) {
  const pageTitles: Record<NavigationPage, { label: string; breadcrumb: string }> = {
    dashboard: { label: 'Operational Overview', breadcrumb: 'IntelliTask / Overview' },
    assistant: { label: 'Autonomous AI Assistant', breadcrumb: 'IntelliTask / Copilot' },
    tasks: { label: 'Task Orchestration Board', breadcrumb: 'IntelliTask / Tasks' },
    planner: { label: 'Autonomous AI Planner', breadcrumb: 'IntelliTask / Planner' },
    research: { label: 'Technical Research Center', breadcrumb: 'IntelliTask / Research' },
    agents: { label: 'LangGraph Agent Fleet', breadcrumb: 'IntelliTask / Agents' },
    settings: { label: 'API & Graph Integration Settings', breadcrumb: 'IntelliTask / Settings' },
  };

  const currentInfo = pageTitles[currentPage];

  return (
    <header className="flex items-center justify-between gap-6 px-6 py-3.5 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur-xs sticky top-0 z-10 select-none">
      {/* Zone 1: Breadcrumb & Title */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xs text-neutral-400 font-mono tracking-tight shrink-0 hidden sm:inline">
          {currentInfo.breadcrumb}
        </span>
        <span className="text-neutral-400 hidden sm:inline" aria-hidden="true">/</span>
        <h1 className="text-sm font-semibold text-neutral-100 truncate">
          {currentInfo.label}
        </h1>
      </div>

      {/* Zone 2: Navigation shortcuts / filter context */}
      <div className="hidden lg:flex items-center gap-4 text-xs font-medium text-neutral-400">
        <button
          onClick={() => onNavigate('tasks')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
            currentPage === 'tasks' ? 'text-white' : ''
          }`}
        >
          Tasks
        </button>
        <span className="text-neutral-800" aria-hidden="true">·</span>
        <button
          onClick={() => onNavigate('planner')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
            currentPage === 'planner' ? 'text-white' : ''
          }`}
        >
          Planner
        </button>
        <span className="text-neutral-800" aria-hidden="true">·</span>
        <button
          onClick={() => onNavigate('research')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
            currentPage === 'research' ? 'text-white' : ''
          }`}
        >
          Research
        </button>
        <span className="text-neutral-800" aria-hidden="true">·</span>
        <button
          onClick={() => onNavigate('agents')}
          className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
            currentPage === 'agents' ? 'text-white' : ''
          }`}
        >
          Agents
        </button>
      </div>

      {/* Zone 3: Actions */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Backend ping status */}
        <button
          onClick={onTestConnection}
          disabled={isCheckingConnection}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800/80 text-xs text-neutral-300 transition-colors"
          title="Verify FastAPI + LangGraph backend connection status"
        >
          <Server className="w-3.5 h-3.5 text-neutral-400" />
          <span className="font-mono text-[11px] hidden md:inline">
            FastAPI:
          </span>
          <span className={`text-[11px] font-medium ${fastApiConnected ? 'text-emerald-400' : 'text-neutral-400'}`}>
            {fastApiConnected ? 'Online' : 'Offline'}
          </span>
          <RefreshCw className={`w-3 h-3 text-neutral-400 ${isCheckingConnection ? 'animate-spin' : ''}`} />
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          className="flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900/60 hover:bg-neutral-800/80 text-xs text-neutral-300 transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{theme === 'dark' ? 'Light' : 'Dark'} mode</span>
        </button>

        {/* Primary CTA */}
        <button
          onClick={onQuickAddTask}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs transition-colors whitespace-nowrap shrink-0 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Task</span>
        </button>
      </div>
    </header>
  );
}
