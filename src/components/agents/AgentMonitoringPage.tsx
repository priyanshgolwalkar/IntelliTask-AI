import { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCw,
  Terminal,
  Cpu,
  Layers,
  ArrowRight,
  Shield,
  Clock,
  Sparkles,
  Search,
  Calendar,
  Brain,
  Plus,
  Trash2,
} from 'lucide-react';
import { Agent, AgentRunLog, Task } from '../../types';
import { geminiService } from '../../services/geminiService';
import { firestoreService, AgentMemoryRecord, AgentLogRecord } from '../../services/firestoreService';

interface AgentMonitoringPageProps {
  agents: Agent[];
  recentRuns: AgentRunLog[];
  onTriggerAgentRun: (agentId: string) => void | Promise<void>;
  fastApiConnected: boolean;
  userId?: string;
  onImportTasks?: (tasks: Omit<Task, 'id' | 'createdAt'>[]) => void;
}

export function AgentMonitoringPage({
  agents,
  recentRuns,
  onTriggerAgentRun,
  fastApiConnected,
  userId,
  onImportTasks,
}: AgentMonitoringPageProps) {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(agents[0] || null);
  const [activeTab, setActiveTab] = useState<'fleet' | 'orchestrate' | 'memory'>('fleet');

  // Multi-Agent Pipeline Execution States
  const [pipelineGoal, setPipelineGoal] = useState(
    'Architect and implement a fault-tolerant multi-agent LangGraph workflow with PostgreSQL checkpointing'
  );
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  const [orchestrationResult, setOrchestrationResult] = useState<any | null>(null);
  const [orchestrationError, setOrchestrationError] = useState<string | null>(null);

  // Persistent Memory States (Firestore)
  const [memories, setMemories] = useState<AgentMemoryRecord[]>([]);
  const [newMemoryCategory, setNewMemoryCategory] = useState('architecture_guideline');
  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [isSavingMemory, setIsSavingMemory] = useState(false);
  const executionLogs = Array.isArray(orchestrationResult?.executionLogs)
    ? orchestrationResult.executionLogs
    : [];
  const planMilestones = Array.isArray(orchestrationResult?.planManifest?.milestones)
    ? orchestrationResult.planManifest.milestones
    : [];

  useEffect(() => {
    if (!agents.length) {
      setSelectedAgent(null);
      return;
    }
    setSelectedAgent((current) =>
      current && agents.some((agent) => agent.id === current.id)
        ? current
        : agents[0]
    );
  }, [agents]);

  // Fetch persistent memories from Firestore
  useEffect(() => {
    async function loadMemories() {
      if (!userId) return;
      try {
        const data = await firestoreService.getAgentMemories(userId);
        if (data) setMemories(data);
      } catch (err) {
        console.warn('Could not load agent memory from Firestore:', err);
      }
    }
    loadMemories();
  }, [userId]);

  const handleRunOrchestration = async () => {
    if (!pipelineGoal.trim() || isOrchestrating) return;
    setIsOrchestrating(true);
    setOrchestrationError(null);

    try {
      const memoryContext = memories.map((m) => `[${m.category}] ${m.content}`);
      const res = await geminiService.orchestrateMultiAgent({
        userGoal: pipelineGoal,
        userId: userId || 'anonymous',
        memoryContext,
        horizonDays: 14,
      });

      setOrchestrationResult(res);

      // Save execution logs to Firestore
      if (userId && Array.isArray(res.executionLogs)) {
        for (const log of res.executionLogs) {
          firestoreService.saveAgentLog(userId, {
            agentId: log.agentId,
            agentName: log.agentName,
            action: log.action,
            decision: log.decision,
            toolName: log.toolName,
            toolInput: log.toolInput,
            toolOutput: log.toolOutput,
            status: log.status,
          }).catch((e) => console.warn('Could not persist agent log to Firestore:', e));
        }
      }
    } catch (err: any) {
      setOrchestrationError(err.message || 'Multi-agent orchestration failed.');
    } finally {
      setIsOrchestrating(false);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemoryContent.trim() || !userId || !selectedAgent || isSavingMemory) return;

    setIsSavingMemory(true);
    try {
      const record = await firestoreService.saveAgentMemory(userId, {
        agentId: selectedAgent.id,
        category: newMemoryCategory,
        content: newMemoryContent.trim(),
      });
      setMemories((prev) => [record, ...prev]);
      setNewMemoryContent('');
    } catch (err: any) {
      console.error('Failed to save memory:', err);
    } finally {
      setIsSavingMemory(false);
    }
  };

  const handleDeleteMemory = async (memoryId: string) => {
    if (!userId) return;
    try {
      await firestoreService.deleteAgentMemory(userId, memoryId);
      setMemories((prev) => prev.filter((m) => m.id !== memoryId));
    } catch (err) {
      console.error('Failed to delete memory:', err);
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            LangGraph Multi-Agent Architecture & Operations
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Manager, Planning, and Research Agents coordinating with live tools and persistent memory.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="inline-flex items-center gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-lg text-xs">
          <button
            onClick={() => setActiveTab('fleet')}
            className={`px-3 py-1.5 font-medium rounded-md transition-colors ${
              activeTab === 'fleet' ? 'bg-neutral-800 text-white shadow-xs' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Agent Fleet
          </button>
          <button
            onClick={() => setActiveTab('orchestrate')}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-medium rounded-md transition-colors ${
              activeTab === 'orchestrate' ? 'bg-indigo-600 text-white shadow-xs' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Autonomous Pipeline</span>
          </button>
          <button
            onClick={() => setActiveTab('memory')}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-medium rounded-md transition-colors ${
              activeTab === 'memory' ? 'bg-neutral-800 text-white shadow-xs' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Persistent Memory ({memories.length})</span>
          </button>
        </div>
        {onImportTasks && (
          <button
            type="button"
            onClick={() => {
              const generated: Omit<Task, 'id' | 'createdAt'>[] = [];
              for (const milestone of planMilestones) {
                for (const task of milestone.tasks || []) {
                  generated.push({
                    title: task.title,
                    description: task.description || '',
                    status: 'todo',
                    priority: task.priority || 'medium',
                    assignedAgent: task.recommendedAgent || 'Planner Architect',
                    tags: ['AI Planner', 'Multi-Agent'],
                    dueDate: new Date(Date.now() + Math.max(1, milestone.dayOffset || 1) * 86400000).toISOString(),
                    estimatedHours: task.estimatedHours || 4,
                    subtasks: [],
                    source: 'ai_planner',
                  });
                }
              }
              if (generated.length) onImportTasks(generated);
            }}
            disabled={planMilestones.length === 0}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
          >
            Save Generated Tasks to Firestore
          </button>
        )}
      </div>

      {/* =====================================================================
          TAB 1: AUTONOMOUS MULTI-AGENT PIPELINE EXECUTION
          ===================================================================== */}
      {activeTab === 'orchestrate' && (
        <div className="space-y-6">
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">Execute Real Multi-Agent Delegation Pipeline</h3>
              </div>
              <span className="text-[11px] font-mono text-neutral-400">
                Manager → Research (DuckDuckGo Search) → Planner (Schedule Calc) → Manager
              </span>
            </div>

            <div>
              <label className="text-xs font-medium text-neutral-300 block mb-1.5">
                Project Goal / Work Order *
              </label>
              <textarea
                rows={2}
                value={pipelineGoal}
                onChange={(e) => setPipelineGoal(e.target.value)}
                placeholder="Specify the objective for the autonomous agents to execute..."
                className="w-full px-4 py-2.5 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-neutral-400">
                Executes actual DuckDuckGo web search, computes deadlines, and generates structured deliverables.
              </span>

              <button
                onClick={handleRunOrchestration}
                disabled={isOrchestrating || !pipelineGoal.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors shrink-0"
              >
                {isOrchestrating ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Orchestrating Agents...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Run Multi-Agent Pipeline</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {orchestrationError && (
            <div className="p-4 bg-rose-950/50 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Execution Error</span>
                <span className="text-[11px] text-rose-300/90">{orchestrationError}</span>
              </div>
            </div>
          )}

          {!orchestrationResult && !orchestrationError && !isOrchestrating && (
            <div className="p-10 text-center bg-neutral-900/40 border border-neutral-800/80 rounded-xl">
              <Activity className="w-7 h-7 text-neutral-600 mx-auto mb-3" />
              <p className="text-xs font-medium text-neutral-200">No Agent Execution Yet</p>
              <p className="text-[11px] text-neutral-400 mt-1">
                Run the pipeline to create an execution log and plan manifest.
              </p>
            </div>
          )}

          {/* Orchestration Results Display */}
          {orchestrationResult && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Executive Directive */}
              <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-6 space-y-3">
                <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
                  <span className="text-xs font-semibold text-indigo-400 font-mono">
                    Manager Agent Directive (Run: {orchestrationResult.runId})
                  </span>
                  <span className={`text-[11px] font-mono ${orchestrationResult.completedAt ? 'text-emerald-400' : 'text-amber-400'}`}>
                    Status: {orchestrationResult.completedAt ? 'Completed' : 'Result incomplete'}
                  </span>
                </div>
                <div className="text-xs text-neutral-200 whitespace-pre-wrap leading-relaxed bg-neutral-950/60 p-4 rounded-lg border border-neutral-800">
                  {orchestrationResult.managerDirective}
                </div>
              </div>

              {/* Execution Steps & Tool Calls Trail */}
              <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-6 space-y-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Step-by-Step Execution Logs & Tool Invocations
                </h4>

                <div className="space-y-3">
                  {executionLogs.map((log: any, idx: number) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-neutral-950/70 border border-neutral-800 rounded-lg text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-neutral-800 text-neutral-300 flex items-center justify-center font-mono text-[10px]">
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-white">{log.agentName}</span>
                          <span className="text-neutral-600" aria-hidden="true">·</span>
                          <span className="text-neutral-400">{log.action}</span>
                        </div>
                        <span className="text-[10px] font-mono text-emerald-400 capitalize">
                          {log.status}
                        </span>
                      </div>

                      <p className="text-[11px] text-neutral-300 pl-7">{log.decision}</p>

                      {log.toolName && (
                        <div className="ml-7 p-2.5 bg-neutral-900/80 border border-neutral-800 rounded-md font-mono text-[11px] space-y-1">
                          <div className="text-indigo-400 flex items-center gap-1">
                            <span>Tool: {log.toolName}</span>
                          </div>
                          {log.toolInput && (
                            <div className="text-neutral-400">
                              Input: <span className="text-neutral-300">{JSON.stringify(log.toolInput)}</span>
                            </div>
                          )}
                          {log.toolOutput && (
                            <div className="text-neutral-400">
                              Output: <span className="text-neutral-300">{JSON.stringify(log.toolOutput)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {executionLogs.length === 0 && (
                    <p className="text-xs text-neutral-400 text-center py-4">
                      No execution logs were returned for this run.
                    </p>
                  )}
                </div>
              </div>

              {/* Research & Plan Highlights Split */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Research Findings */}
                <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white pb-2 border-b border-neutral-800">
                    <Search className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Research Agent Findings</span>
                  </div>
                  <p className="text-xs text-neutral-300">
                    {orchestrationResult.researchDossier?.executiveSummary || 'No research synthesis was returned.'}
                  </p>
                  {orchestrationResult.researchDossier?.sources?.length > 0 && (
                    <div className="pt-2 border-t border-neutral-800/80 text-[11px] space-y-1">
                      <span className="text-neutral-400 block font-medium">Verified Web Sources:</span>
                      {orchestrationResult.researchDossier.sources.map((s: any, i: number) => (
                        <a
                          key={i}
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-400 hover:underline block truncate"
                        >
                          › {s.title} <span className="text-neutral-500">({s.source || 'source'})</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Planning Milestones */}
                <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-5 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white pb-2 border-b border-neutral-800">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Planning Agent Milestones</span>
                  </div>
                  <div className="space-y-2">
                    {planMilestones.map((m: any, i: number) => (
                      <div key={i} className="p-2.5 bg-neutral-950/60 border border-neutral-800 rounded-lg text-xs">
                        <div className="flex justify-between font-semibold text-neutral-200">
                          <span>{m.title}</span>
                          <span className="font-mono text-[11px] text-neutral-400">{m.targetDate}</span>
                        </div>
                        <p className="text-[11px] text-neutral-400 mt-1">{m.description}</p>
                      </div>
                    ))}
                    {planMilestones.length === 0 && (
                      <p className="text-xs text-neutral-400 text-center py-4">
                        No plan manifest or milestones were returned.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: PERSISTENT AGENT MEMORY (FIRESTORE)
          ===================================================================== */}
      {activeTab === 'memory' && (
        <div className="space-y-6">
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">Persistent Agent Memory (Firestore)</h3>
              </div>
              <span className="text-[11px] font-mono text-neutral-400">
                Path: /users/{userId ? userId.slice(0, 8) + '...' : 'uid'}/agent_memory
              </span>
            </div>

            <p className="text-xs text-neutral-400">
              Agents consult this persistent memory store on every multi-agent pipeline execution to adhere to your architectural standards, security rules, and project context.
            </p>

            {/* Add memory form */}
            <form onSubmit={handleAddMemory} className="space-y-3 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-neutral-300 font-medium block mb-1">Category</label>
                  <select
                    value={newMemoryCategory}
                    onChange={(e) => setNewMemoryCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="architecture_guideline">Architecture Guideline</option>
                    <option value="tech_stack_rule">Tech Stack Rule</option>
                    <option value="security_invariant">Security Invariant</option>
                    <option value="coding_standard">Coding Standard</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="text-neutral-300 font-medium block mb-1">Instruction / Guideline</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={newMemoryContent}
                      onChange={(e) => setNewMemoryContent(e.target.value)}
                      placeholder="e.g. Always mandate sub-200ms latency budgets and Pydantic v2 validation"
                      className="flex-1 px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={isSavingMemory || !newMemoryContent.trim()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors shrink-0"
                    >
                      {isSavingMemory ? 'Saving...' : 'Add Memory'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Stored memories list */}
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-6 space-y-3">
            <h4 className="text-xs font-semibold text-white mb-2">Stored Memories ({memories.length})</h4>
            {memories.length > 0 ? (
              <div className="space-y-2">
                {memories.map((mem) => (
                  <div
                    key={mem.id}
                    className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-lg text-xs flex items-center justify-between gap-3"
                  >
                    <div>
                      <span className="font-mono text-[10px] text-indigo-400 uppercase tracking-wider block">
                        {mem.category.replace('_', ' ')}
                      </span>
                      <p className="text-neutral-200 mt-0.5">{mem.content}</p>
                      <span className="text-[10px] text-neutral-500 font-mono mt-1 block">
                        Updated {new Date(mem.updatedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <button
                      onClick={() => handleDeleteMemory(mem.id)}
                      className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-neutral-900 rounded-md transition-colors"
                      title="Delete memory item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-neutral-400 border border-dashed border-neutral-800 rounded-lg">
                No custom agent memories saved in Firestore yet. Add a rule or guideline above.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: AGENT FLEET INSPECTION (DEFAULT)
          ===================================================================== */}
      {activeTab === 'fleet' && (
        <div className="space-y-8">
          {/* Agent Fleet Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => {
              const isSelected = selectedAgent?.id === agent.id;
              return (
                <div
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className={`p-5 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-neutral-900 border-indigo-500/80 shadow-md ring-1 ring-indigo-500/30'
                      : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-white">{agent.name}</h3>
                      <p className="text-[11px] text-neutral-400">{agent.role}</p>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded capitalize ${
                        agent.status === 'running'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-neutral-800 text-neutral-300'
                      }`}
                    >
                      {agent.status}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-300 mt-3 line-clamp-2 leading-relaxed">
                    {agent.description}
                  </p>

                  <div className="mt-4 pt-3 border-t border-neutral-800/80 grid grid-cols-2 gap-2 text-[11px] font-mono tabular-nums">
                    <div>
                      <span className="text-neutral-400 block text-[10px]">Tasks Handled</span>
                      <span className="text-neutral-200 font-semibold">{agent.tasksCompleted}</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block text-[10px]">Success Rate</span>
                      <span className="text-emerald-400 font-semibold">{agent.successRate}%</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-neutral-400">
                    <span className="font-mono truncate">Model: {agent.model}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTriggerAgentRun(agent.id);
                      }}
                      className="px-2.5 py-1 text-[11px] font-medium text-neutral-200 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-md transition-colors"
                    >
                      Dispatch
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Agent Inspector */}
          {selectedAgent && (
            <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-6 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-neutral-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-indigo-400">Node ID: {selectedAgent.id}</span>
                    <span className="text-neutral-600" aria-hidden="true">·</span>
                    <h3 className="text-base font-bold text-white">{selectedAgent.name}</h3>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">{selectedAgent.description}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onTriggerAgentRun(selectedAgent.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Trigger Node</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-xs">
                {/* Tool Arsenal */}
                <div className="p-4 bg-neutral-950/60 border border-neutral-800 rounded-lg space-y-2">
                  <span className="text-neutral-400 font-medium block">Configured Tools & Capabilities:</span>
                  <ul className="space-y-1.5">
                    {selectedAgent.tools.map((t, idx) => (
                      <li key={idx} className="font-mono text-[11px] text-neutral-300 flex items-center gap-1.5">
                        <span className="text-indigo-400">›</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Channel Subscriptions */}
                <div className="p-4 bg-neutral-950/60 border border-neutral-800 rounded-lg space-y-3">
                  <span className="text-neutral-400 font-medium block">LangGraph State Channels:</span>
                  <div>
                    <span className="text-[11px] text-neutral-400 block">Input State Channel:</span>
                    <code className="text-neutral-200 font-mono text-[11px] bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800 block mt-0.5">
                      {selectedAgent.inputChannel}
                    </code>
                  </div>
                  <div>
                    <span className="text-[11px] text-neutral-400 block">Output Reducer Channel:</span>
                    <code className="text-neutral-200 font-mono text-[11px] bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800 block mt-0.5">
                      {selectedAgent.outputChannel}
                    </code>
                  </div>
                </div>

                {/* Performance telemetry */}
                <div className="p-4 bg-neutral-950/60 border border-neutral-800 rounded-lg space-y-2">
                  <span className="text-neutral-400 font-medium block">Node Metrics:</span>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Historical Dispatches:</span>
                      <span className="font-mono text-neutral-200 tabular-nums">{selectedAgent.tasksCompleted}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Invariants Validated:</span>
                      <span className="font-mono text-emerald-400 tabular-nums">{selectedAgent.successRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-400">Last Active:</span>
                      <span className="font-mono text-neutral-400">
                        {selectedAgent.lastRun ? new Date(selectedAgent.lastRun).toLocaleTimeString() : 'Never'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Execution Audit Log Table */}
          <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div>
                <h3 className="text-sm font-semibold text-white">Live Execution Telemetry & Run History</h3>
                <p className="text-xs text-neutral-400 mt-0.5">Audit log of agent dispatches and node state modifications</p>
              </div>
              <span className="text-xs font-mono text-neutral-400 tabular-nums">
                {recentRuns.length} runs logged
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-800 text-neutral-400 font-medium bg-neutral-950/50">
                    <th className="py-2.5 px-3 w-28">Run ID</th>
                    <th className="py-2.5 px-3 w-40">Agent Node</th>
                    <th className="py-2.5 px-3">Task Objective</th>
                    <th className="py-2.5 px-3 w-24">Status</th>
                    <th className="py-2.5 px-3 w-24 text-right">Tokens</th>
                    <th className="py-2.5 px-3 w-32 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {recentRuns.map((run) => (
                    <tr key={run.id} className="hover:bg-neutral-800/30 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-neutral-400">{run.id}</td>
                      <td className="py-2.5 px-3 font-medium text-neutral-200">{run.agentName}</td>
                      <td className="py-2.5 px-3 text-neutral-300">
                        <div>{run.taskTitle}</div>
                        <div className="text-[11px] text-neutral-400">{run.message}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded capitalize ${
                            run.status === 'success'
                              ? 'text-emerald-400 bg-emerald-950/40'
                              : 'text-amber-400 bg-amber-950/40'
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-neutral-300">
                        {run.tokensUsed}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-[11px] text-neutral-400">
                        {new Date(run.startedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
