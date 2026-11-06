import { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardPage } from './components/dashboard/DashboardPage';
import { AIAssistantPage } from './components/assistant/AIAssistantPage';
import { TaskManagerPage } from './components/tasks/TaskManagerPage';
import { AIPlannerPage } from './components/planner/AIPlannerPage';
import { ResearchCenterPage } from './components/research/ResearchCenterPage';
import { AgentMonitoringPage } from './components/agents/AgentMonitoringPage';
import { SettingsPage } from './components/settings/SettingsPage';

import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { ForgotPasswordPage } from './components/auth/ForgotPasswordPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import { taskStorage } from './services/taskStorage';
import { agentRegistry } from './services/agentRegistry';
import { fastApiClient, ConnectionTestResult } from './services/fastapiClient';
import { geminiService } from './services/geminiService';
import { NavigationPage, Task, FastAPISettings, Agent, AgentRunLog } from './types';
import { Workflow, Mail, CheckCircle2 } from 'lucide-react';

function IntelliTaskApp() {
  const { currentUser, userProfile, loading, logout, sendVerification } = useAuth();

  // Auth pages view mode
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot-password'>('login');

  // App navigation & data states
  const [currentPage, setCurrentPage] = useState<NavigationPage>('dashboard');
  const [tasks, setTasks] = useState<Task[]>(() => taskStorage.getAll());
  const [agents, setAgents] = useState<Agent[]>(() => agentRegistry.getAgents());
  const [recentRuns, setRecentRuns] = useState<AgentRunLog[]>(() => agentRegistry.getRecentRuns());
  const [fastApiSettings, setFastApiSettings] = useState<FastAPISettings>(() =>
    fastApiClient.getSettings()
  );

  // Persist the user's appearance preference across reloads.
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem('intellitask_theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('intellitask_theme', theme);
    } catch {
      // Ignore unavailable browser storage.
    }
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  };

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Firestore task synchronization states
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  // Real connection status states
  const [geminiConfigured, setGeminiConfigured] = useState(false);
  const [fastApiConnected, setFastApiConnected] = useState(false);
  const [isCheckingConnection, setIsCheckingConnection] = useState(false);

  // Verification banner feedback state
  const [verificationSent, setVerificationSent] = useState(false);
  const [isSendingVerification, setIsSendingVerification] = useState(false);

  // Load user isolated tasks whenever authentication state changes
  useEffect(() => {
    async function syncUserTasks() {
      setIsLoadingTasks(true);
      setTaskError(null);
      try {
        if (currentUser) {
          const userTasks = await taskStorage.setUserId(currentUser.uid);
          setTasks(userTasks);
          const removedIds = taskStorage.getLastLegacyCleanup();
          const missingIds = ['TASK-107', 'TASK-103', 'TASK-106'].filter(
            (id) => !removedIds.includes(id)
          );
          if (removedIds.length > 0) {
            console.info('Removed legacy development tasks for the current user:', removedIds);
          }
          if (missingIds.length > 0) {
            console.info('Legacy task IDs not found in the current user collection:', missingIds);
          }
        } else {
          const guestTasks = await taskStorage.setUserId(null);
          setTasks(guestTasks);
        }
      } catch (err: any) {
        setTaskError(err.message || 'Error synchronizing Firestore tasks');
      } finally {
        setIsLoadingTasks(false);
      }
    }
    syncUserTasks();
  }, [currentUser]);

  // Initial health check on mount
  useEffect(() => {
    async function checkInitialHealth() {
      const health = await geminiService.getHealth();
      setGeminiConfigured(health.geminiConfigured);

      // Perform connection check to configured FastAPI backend
      testFastApiConnection(fastApiSettings.baseUrl);
    }
    checkInitialHealth();
  }, []);

  const testFastApiConnection = async (url?: string): Promise<ConnectionTestResult> => {
    setIsCheckingConnection(true);
    try {
      const result = await fastApiClient.testConnection(url || fastApiSettings.baseUrl);
      setFastApiConnected(result.connected);
      return result;
    } finally {
      setIsCheckingConnection(false);
    }
  };

  // Task Handlers
  const handleAddTask = async (taskData: Omit<Task, 'id' | 'createdAt'>) => {
    const created = await taskStorage.create(taskData);
    setTasks(taskStorage.getAll());
    return created;
  };

  const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
    await taskStorage.update(id, updates);
    setTasks(taskStorage.getAll());
  };

  const handleDeleteTask = async (id: string) => {
    const deletion = taskStorage.delete(id);
    setTasks(taskStorage.getAll());
    await deletion;
  };

  const handleToggleSubtask = async (taskId: string, subtaskId: string) => {
    await taskStorage.toggleSubtask(taskId, subtaskId);
    setTasks(taskStorage.getAll());
  };

  const handleImportTasks = async (newTasks: Omit<Task, 'id' | 'createdAt'>[]) => {
    for (const t of newTasks) {
      await taskStorage.create(t);
    }
    setTasks(taskStorage.getAll());
  };

  // Agent Dispatch Trigger
  const handleTriggerAgentRun = async (agentId: string) => {
    const targetAgent = agents.find((a) => a.id === agentId);
    if (!targetAgent) return;
    agentRegistry.updateAgentStatus(agentId, 'running', targetAgent.role);
    setAgents(agentRegistry.getAgents());
    const startedAt = new Date().toISOString();
    try {
      const result = await geminiService.orchestrateMultiAgent({
        userGoal: `Execute ${targetAgent.role} responsibilities for the current IntelliTask workspace.`,
        userId: currentUser?.uid || 'anonymous',
        horizonDays: 14,
      });
      const finishedAt = new Date().toISOString();
      agentRegistry.addRunLog({
        id: result.runId,
        agentId: targetAgent.id,
        agentName: targetAgent.name,
        taskTitle: targetAgent.role,
        startedAt,
        finishedAt,
        status: 'success',
        message: result.managerDirective,
      });
      agentRegistry.updateAgentStatus(agentId, 'idle');
    } catch (error: any) {
      agentRegistry.addRunLog({
        id: `run-${Date.now().toString().slice(-4)}`,
        agentId: targetAgent.id,
        agentName: targetAgent.name,
        taskTitle: targetAgent.role,
        startedAt,
        finishedAt: new Date().toISOString(),
        status: 'failed',
        message: error?.message || 'Agent run failed.',
      });
      agentRegistry.updateAgentStatus(agentId, 'error');
    } finally {
      setAgents(agentRegistry.getAgents());
      setRecentRuns(agentRegistry.getRecentRuns());
    }
  };

  // Settings Handlers
  const handleUpdateFastAPISettings = (newSettings: FastAPISettings) => {
    fastApiClient.saveSettings(newSettings);
    setFastApiSettings(newSettings);
    testFastApiConnection(newSettings.baseUrl);
  };

  const handleExportAll = () => {
    const exportData = {
      app: 'IntelliTask AI',
      exportedAt: new Date().toISOString(),
      user: {
        uid: currentUser?.uid,
        email: currentUser?.email,
      },
      tasks: taskStorage.getAll(),
      agents: agentRegistry.getAgents(),
      settings: fastApiSettings,
    };

    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `intellitask-backup-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportAll = (jsonStr: string): boolean => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.tasks && Array.isArray(parsed.tasks)) {
        taskStorage.importJSON(JSON.stringify(parsed.tasks));
        setTasks(taskStorage.getAll());
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const handleSendVerification = async () => {
    if (isSendingVerification) return;
    setIsSendingVerification(true);
    try {
      await sendVerification();
      setVerificationSent(true);
      setTimeout(() => setVerificationSent(false), 5000);
    } catch (err) {
      console.warn('Verification dispatch error:', err);
    } finally {
      setIsSendingVerification(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 1. Loading State (Checking persistent authentication session)
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="min-h-screen w-full bg-neutral-950 flex flex-col items-center justify-center font-sans text-neutral-100">
        <div className="flex flex-col items-center space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-lg shadow-indigo-500/10 animate-pulse">
            <Workflow className="w-6 h-6" />
          </div>
          <div className="text-center space-y-1">
            <h2 className="text-sm font-semibold tracking-tight text-white">IntelliTask AI</h2>
            <p className="text-xs text-neutral-500 font-mono">Initializing secure authentication session...</p>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 2. Unauthenticated State (Protected Route Gate)
  // ---------------------------------------------------------------------------
  if (!currentUser) {
    if (authMode === 'register') {
      return <RegisterPage onNavigateToLogin={() => setAuthMode('login')} />;
    }
    if (authMode === 'forgot-password') {
      return <ForgotPasswordPage onNavigateToLogin={() => setAuthMode('login')} />;
    }
    return (
      <LoginPage
        onNavigateToRegister={() => setAuthMode('register')}
        onNavigateToForgotPassword={() => setAuthMode('forgot-password')}
      />
    );
  }

  // ---------------------------------------------------------------------------
  // 3. Authenticated State (Protected Dashboard & Workspace)
  // ---------------------------------------------------------------------------
  const showUnverifiedBanner = currentUser && !currentUser.emailVerified;

  return (
    <div className="flex h-screen w-full bg-neutral-950 text-neutral-100 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        taskCount={tasks.length}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        fastApiConnected={fastApiConnected}
        geminiConfigured={geminiConfigured}
        userProfile={userProfile}
        onLogout={logout}
        onSendVerification={handleSendVerification}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Email Verification Banner (if unverified) */}
        {showUnverifiedBanner && (
          <div className="bg-amber-950/60 border-b border-amber-800/60 px-6 py-2 text-xs flex flex-wrap items-center justify-between gap-2 text-amber-200">
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                Your email address (<span className="font-mono text-white">{currentUser.email}</span>) is not yet verified.
              </span>
            </div>
            <div className="flex items-center gap-2">
              {verificationSent ? (
                <span className="flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Verification link sent</span>
                </span>
              ) : (
                <button
                  onClick={handleSendVerification}
                  disabled={isSendingVerification}
                  className="px-2.5 py-1 bg-amber-900/60 hover:bg-amber-800 text-amber-100 font-medium rounded-md text-[11px] transition-colors"
                >
                  {isSendingVerification ? 'Sending...' : 'Resend verification email'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Top Header Bar */}
        <Header
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          onQuickAddTask={() => setCurrentPage('tasks')}
          onTestConnection={() => testFastApiConnection()}
          isCheckingConnection={isCheckingConnection}
          fastApiConnected={fastApiConnected}
          geminiConfigured={geminiConfigured}
          theme={theme}
          onToggleTheme={handleToggleTheme}
        />

        {/* Dynamic Page Router */}
        <main className="flex-1 overflow-y-auto">
          {currentPage === 'dashboard' && (
            <DashboardPage
              tasks={tasks}
              agents={agents}
              recentRuns={recentRuns}
              onNavigate={setCurrentPage}
              onSelectTask={(task) => {
                setSelectedTask(task);
                setCurrentPage('tasks');
              }}
              fastApiConnected={fastApiConnected}
              geminiConfigured={geminiConfigured}
              isLoadingTasks={isLoadingTasks}
              taskError={taskError}
            />
          )}

          {currentPage === 'assistant' && (
            <AIAssistantPage tasks={tasks} geminiConfigured={geminiConfigured} />
          )}

          {currentPage === 'tasks' && (
            <TaskManagerPage
              tasks={tasks}
              onAddTask={handleAddTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              onToggleSubtask={handleToggleSubtask}
              selectedTask={selectedTask}
              onSelectTask={setSelectedTask}
              isLoading={isLoadingTasks}
              error={taskError}
            />
          )}

          {currentPage === 'planner' && (
            <AIPlannerPage
              onImportTasks={(imported) => {
                handleImportTasks(imported);
              }}
              geminiConfigured={geminiConfigured}
            />
          )}

          {currentPage === 'research' && (
            <ResearchCenterPage
              onImportTask={(task) => {
                handleAddTask(task);
                setCurrentPage('tasks');
              }}
              geminiConfigured={geminiConfigured}
            />
          )}

          {currentPage === 'agents' && (
            <AgentMonitoringPage
              agents={agents}
              recentRuns={recentRuns}
              onTriggerAgentRun={handleTriggerAgentRun}
              fastApiConnected={fastApiConnected}
              userId={currentUser.uid}
              onImportTasks={handleImportTasks}
            />
          )}

          {currentPage === 'settings' && (
            <SettingsPage
              fastApiSettings={fastApiSettings}
              onUpdateFastAPISettings={handleUpdateFastAPISettings}
              onTestConnection={testFastApiConnection}
              geminiConfigured={geminiConfigured}
              onExportAll={handleExportAll}
              onImportAll={handleImportAll}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <IntelliTaskApp />
    </AuthProvider>
  );
}
