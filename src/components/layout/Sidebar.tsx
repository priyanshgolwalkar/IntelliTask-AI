import {
  LayoutDashboard,
  Bot,
  CheckSquare,
  Network,
  BookOpen,
  Activity,
  Settings,
  ChevronLeft,
  ChevronRight,
  Workflow,
  LogOut,
  Mail,
  User as UserIcon,
} from 'lucide-react';
import { NavigationPage, UserProfile } from '../../types';

interface SidebarProps {
  currentPage: NavigationPage;
  onNavigate: (page: NavigationPage) => void;
  taskCount: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  fastApiConnected: boolean;
  geminiConfigured: boolean;
  userProfile?: UserProfile | null;
  onLogout?: () => void;
  onSendVerification?: () => void;
}

export function Sidebar({
  currentPage,
  onNavigate,
  taskCount,
  isCollapsed,
  onToggleCollapse,
  fastApiConnected,
  geminiConfigured,
  userProfile,
  onLogout,
  onSendVerification,
}: SidebarProps) {
  const navItems: { id: NavigationPage; label: string; icon: React.ElementType; badge?: string | number }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'assistant', label: 'AI Assistant', icon: Bot },
    { id: 'tasks', label: 'Task Management', icon: CheckSquare, badge: taskCount },
    { id: 'planner', label: 'AI Planner', icon: Network },
    { id: 'research', label: 'Research Center', icon: BookOpen },
    { id: 'agents', label: 'Agent Monitoring', icon: Activity },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const userInitial = userProfile?.fullName
    ? userProfile.fullName.charAt(0).toUpperCase()
    : 'U';

  return (
    <aside
      className={`relative flex flex-col h-screen border-r border-neutral-800 bg-neutral-950 transition-all duration-200 select-none z-20 ${
        isCollapsed ? 'w-18' : 'w-64'
      }`}
    >
      {/* Brand Zone */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-neutral-800">
        <button
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-3 text-left overflow-hidden focus:outline-hidden"
        >
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shrink-0">
            <Workflow className="w-5 h-5" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col truncate">
              <span className="text-sm font-semibold tracking-tight text-white whitespace-nowrap">
                IntelliTask AI
              </span>
              <span className="text-[11px] text-neutral-400 font-mono tracking-tight whitespace-nowrap">
                Autonomous Engine
              </span>
            </div>
          )}
        </button>

        <button
          onClick={onToggleCollapse}
          className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 rounded-md transition-colors"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors text-left group ${
                isActive
                  ? 'bg-neutral-800/90 text-white font-semibold shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60'
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? 'text-indigo-400' : 'text-neutral-400 group-hover:text-neutral-300'
                }`}
              />
              {!isCollapsed && (
                <div className="flex items-center justify-between flex-1 truncate">
                  <span className="truncate">{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`text-[11px] font-mono tabular-nums px-2 py-0.5 rounded ${
                        isActive
                          ? 'bg-neutral-700 text-neutral-200'
                          : 'bg-neutral-900 text-neutral-500'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Profile & Engine Status Zone */}
      <div className="p-3 border-t border-neutral-800 bg-neutral-950 space-y-2">
        {!isCollapsed && (
          <div className="p-2.5 bg-neutral-900/60 border border-neutral-800/80 rounded-lg text-xs space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-neutral-400">Gemini Core</span>
              <span className={geminiConfigured ? 'text-emerald-400 font-medium' : 'text-neutral-400'}>
                {geminiConfigured ? 'Configured' : 'Offline'}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-neutral-400">FastAPI Backend</span>
              <span className={fastApiConnected ? 'text-emerald-400 font-medium' : 'text-neutral-400'}>
                {fastApiConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        )}

        {/* Authenticated User Profile */}
        {userProfile && (
          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-neutral-900 border border-neutral-800">
            <div className="flex items-center gap-2.5 min-w-0">
              {userProfile.photoURL ? (
                <img
                  src={userProfile.photoURL}
                  alt={userProfile.fullName}
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-full object-cover border border-neutral-700 shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-semibold flex items-center justify-center text-xs shrink-0">
                  {userInitial}
                </div>
              )}
              {!isCollapsed && (
                <div className="truncate text-left">
                  <span className="text-xs font-semibold text-neutral-200 block truncate">
                    {userProfile.fullName}
                  </span>
                  <span className="text-[10px] text-neutral-400 block truncate font-mono">
                    {userProfile.email}
                  </span>
                </div>
              )}
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded-md transition-colors shrink-0"
                title="Sign out of IntelliTask AI"
                aria-label="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
