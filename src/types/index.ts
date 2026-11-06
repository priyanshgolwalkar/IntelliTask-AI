export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'completed' | 'blocked';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  userId?: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedAgent: string;
  tags: string[];
  createdAt: string;
  dueDate: string;
  estimatedHours: number;
  subtasks: Subtask[];
  source: 'manual' | 'ai_planner' | 'langgraph' | 'research';
  langGraphNodeId?: string;
}

export type AgentType = 'supervisor' | 'researcher' | 'planner' | 'python_planner' | 'coder' | 'reviewer';
export type AgentStatus = 'idle' | 'running' | 'waiting_approval' | 'offline' | 'error';

export interface Agent {
  id: string;
  name: string;
  role: string;
  type: AgentType;
  status: AgentStatus;
  description: string;
  model: string;
  tools: string[];
  inputChannel: string;
  outputChannel: string;
  tasksCompleted: number;
  activeTask?: string;
  lastRun?: string;
  successRate: number;
}

export interface AgentRunLog {
  id: string;
  agentId: string;
  agentName: string;
  taskTitle: string;
  startedAt: string;
  finishedAt?: string;
  status: 'success' | 'running' | 'failed' | 'cancelled';
  tokensUsed?: number;
  channelSnapshot?: Record<string, any>;
  message: string;
}

export interface MilestoneTask {
  title: string;
  description: string;
  priority: TaskPriority;
  estimatedHours: number;
  recommendedAgent: string;
  dependencies: string[];
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  dayOffset: number;
  tasks: MilestoneTask[];
}

export interface LangGraphNodeSpec {
  nodeName: string;
  agentRole: string;
  inputChannel: string;
  outputChannel: string;
}

export interface GeneratedPlan {
  title: string;
  summary: string;
  estimatedDays: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  milestones: Milestone[];
  langGraphExecutionNodes: LangGraphNodeSpec[];
  criticalRisks: string[];
  generatedAt?: string;
}

export interface ArchitecturalPattern {
  patternName: string;
  pros: string[];
  cons: string[];
  recommendedWhen: string;
}

export interface TechnicalRecommendation {
  area: string;
  recommendation: string;
  rationale: string;
}

export interface ResearchDossier {
  topic: string;
  executiveSummary: string;
  keyFindings: string[];
  architecturalPatterns: ArchitecturalPattern[];
  technicalRecommendations: TechnicalRecommendation[];
  implementationRoadmap: { phase: string; deliverables: string[] }[];
  confidenceScore: number;
  suggestedTasks: {
    title: string;
    priority: TaskPriority;
    assignedAgent: string;
  }[];
  researchedAt?: string;
}

export interface FastAPISettings {
  baseUrl: string;
  apiKey: string;
  graphId: string;
  timeoutSeconds: number;
  streamLogs: boolean;
  autoSyncTasks: boolean;
}

export interface SystemHealth {
  serverConnected: boolean;
  geminiConfigured: boolean;
  fastApiConnected: boolean;
  fastApiLatencyMs?: number;
  fastApiStatusCode?: number;
  fastApiError?: string;
  lastChecked: string;
}

export type NavigationPage =
  | 'dashboard'
  | 'assistant'
  | 'tasks'
  | 'planner'
  | 'research'
  | 'agents'
  | 'settings';

export interface UserPreferences {
  theme?: 'dark' | 'light';
  autoSyncTasks?: boolean;
  defaultAgent?: string;
  notificationsEnabled?: boolean;
}

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  createdAt: string;
  updatedAt?: string;
  emailVerified: boolean;
  preferences?: UserPreferences;
  photoURL?: string;
}
