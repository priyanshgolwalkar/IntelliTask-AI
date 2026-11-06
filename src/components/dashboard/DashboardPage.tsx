import {
  CheckSquare,
  BookOpen,
  Activity,
  ArrowRight,
  AlertTriangle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Agent, AgentRunLog, NavigationPage, Task } from '../../types';

interface DashboardPageProps {
  tasks: Task[];
  agents: Agent[];
  recentRuns: AgentRunLog[];
  onNavigate: (page: NavigationPage) => void;
  onSelectTask: (task: Task) => void;
  fastApiConnected: boolean;
  geminiConfigured: boolean;
  isLoadingTasks?: boolean;
  taskError?: string | null;
}

export function DashboardPage({
  tasks,
  agents,
  recentRuns,
  onNavigate,
  onSelectTask,
  fastApiConnected,
  geminiConfigured,
  isLoadingTasks = false,
  taskError = null,
}: DashboardPageProps) {
  const totalTasks = tasks.length;
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
  const completed = tasks.filter((t) => t.status === 'completed').length;
  const blocked = tasks.filter((t) => t.status === 'blocked').length;
  const pending = tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress' || t.status === 'in_review').length;
  const runningAgents = agents.filter((agent) => agent.status === 'running').length;
  const errorAgents = agents.filter((agent) => agent.status === 'error' || agent.status === 'offline').length;

  const urgentTasks = tasks.filter(
    (t) => (t.priority === 'urgent' || t.priority === 'high') && t.status !== 'completed'
  );


  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Task Error Banner if any */}
      {taskError && (
        <div className="p-4 bg-rose-950/50 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Firestore Sync Error</span>
            <span className="text-[11px] text-rose-300/90">{taskError}</span>
          </div>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-neutral-800">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-white">
            Autonomous Task Orchestration & Agent Operations
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Coordinating multi-agent workflows, decomposition graphs, and task execution pipelines.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('planner')}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Formulate Plan</span>
          </button>
          <button
            onClick={() => onNavigate('research')}
            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-neutral-400" />
            <span>Research Topic</span>
          </button>
        </div>
      </div>

      {/* KPI Overview Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Total Tasks</span>
            <CheckSquare className="w-4 h-4 text-neutral-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-white">
              {totalTasks}
            </span>
            <span className="text-xs text-neutral-400">saved records</span>
          </div>
          <div className="mt-2 text-[11px] text-neutral-400">
            {completed} verified complete
          </div>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Pending Tasks</span>
            <Activity className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-amber-300">
              {pending}
            </span>
            <span className="text-xs text-neutral-400">
              {inProgress} in progress
            </span>
          </div>
          <div className="mt-2 text-[11px] text-neutral-400">
            Not completed or blocked
          </div>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Blocked Items</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-rose-300">
              {blocked}
            </span>
            <span className="text-xs text-neutral-400">requires input</span>
          </div>
          <div className="mt-2 text-[11px] text-neutral-400">
            {blocked > 0 ? 'Review dependencies' : 'Zero blockers detected'}
          </div>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-400">Agent Execution Status</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-emerald-300">
              {runningAgents}
            </span>
            <span className="text-xs text-neutral-400">running</span>
          </div>
          <div className="mt-2 text-[11px] text-neutral-400">
            {errorAgents > 0 ? `${errorAgents} agent(s) offline/error` : `${agents.length} configured agents`}
          </div>
        </div>
      </div>

      {/* Main 2-Column Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: High Priority Queue & Task State */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <div>
                <h3 className="text-sm font-semibold text-white">Priority Task Backlog</h3>
                <p className="text-xs text-neutral-400 mt-0.5">High-impact tasks demanding engineering & agent attention</p>
              </div>
              <button
                onClick={() => onNavigate('tasks')}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                <span>View all</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-neutral-800/80">
              {isLoadingTasks ? (
                <div className="py-8 text-center space-y-2">
                  <span className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin inline-block" />
                  <p className="text-xs text-neutral-400">Loading tasks from Firestore...</p>
                </div>
              ) : urgentTasks.length > 0 ? (
                urgentTasks.slice(0, 5).map((task) => (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask(task)}
                    className="py-3.5 flex items-start justify-between gap-4 group cursor-pointer hover:bg-neutral-800/30 px-2 rounded-lg transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-neutral-400">{task.id}</span>
                        <span className="text-neutral-600" aria-hidden="true">·</span>
                        <span className="text-xs font-medium text-neutral-100 group-hover:text-indigo-300 transition-colors truncate">
                          {task.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-neutral-400">
                        <span>{task.assignedAgent}</span>
                        <span aria-hidden="true">·</span>
                        <span>{task.estimatedHours}h est</span>
                        <span aria-hidden="true">·</span>
                        <span className="capitalize">{task.status.replace('_', ' ')}</span>
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-mono px-2 py-0.5 rounded capitalize shrink-0 ${
                        task.priority === 'urgent'
                          ? 'text-rose-300 bg-rose-950/60 border border-rose-800/50'
                          : 'text-amber-300 bg-amber-950/60 border border-amber-800/50'
                      }`}
                    >
                      {task.priority}
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center space-y-3">
                  <div className="w-8 h-8 rounded-lg bg-neutral-800/60 text-neutral-400 flex items-center justify-center mx-auto">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-neutral-200">No priority tasks</p>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      {tasks.length === 0
                        ? 'Your Firestore task collection is currently empty.'
                        : 'No pending urgent or high-priority tasks in your backlog.'}
                    </p>
                  </div>
                  <button
                    onClick={() => onNavigate('tasks')}
                    className="px-3 py-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-colors"
                  >
                    + Create a Task
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Quick Architecture Overview */}
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white">LangGraph Orchestration Topology</h3>
            <p className="text-xs text-neutral-400 mt-1 mb-4">
              StateGraph state transitions and persistent state channel schema.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-lg text-xs space-y-1">
                <span className="text-neutral-400 block text-[11px]">Entry Node</span>
                <span className="font-semibold text-white">Supervisor</span>
                <span className="text-[11px] text-neutral-400 block font-mono">Channel: task_graph_input</span>
              </div>
              <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-lg text-xs space-y-1">
                <span className="text-neutral-400 block text-[11px]">Reasoning Node</span>
                <span className="font-semibold text-white">Researcher</span>
                <span className="text-[11px] text-neutral-400 block font-mono">Channel: research_dossier</span>
              </div>
              <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-lg text-xs space-y-1">
                <span className="text-neutral-400 block text-[11px]">Execution Node</span>
                <span className="font-semibold text-white">Code Generator</span>
                <span className="text-[11px] text-neutral-400 block font-mono">Channel: code_artifacts</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Fleet Status & Recent Run Log */}
        <div className="lg:col-span-5 space-y-6">
          {/* Agent Fleet Health */}
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <h3 className="text-sm font-semibold text-white">Agent Fleet Status</h3>
              <button
                onClick={() => onNavigate('agents')}
                className="text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                Inspect fleet
              </button>
            </div>
            <div className="space-y-3 mt-4">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-950/40 border border-neutral-800/80 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-white block truncate">{agent.name}</span>
                    <span className="text-[11px] text-neutral-400 truncate block">{agent.role}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono tabular-nums text-neutral-300 block">
                      {agent.tasksCompleted} tasks
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      {agent.successRate}% rate
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Audit / Run History */}
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-6">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
              <h3 className="text-sm font-semibold text-white">Recent Execution Log</h3>
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
            </div>
            <div className="space-y-3 mt-4">
              {recentRuns.map((run) => (
                <div key={run.id} className="text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-neutral-200">{run.agentName}</span>
                    <span className="text-[11px] font-mono text-neutral-400">
                      {run.tokensUsed} tokens
                    </span>
                  </div>
                  <p className="text-neutral-400 text-[11px]">{run.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
