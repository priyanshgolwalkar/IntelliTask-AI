import { Agent, AgentRunLog } from '../types';

export const INITIAL_AGENTS: Agent[] = [
  {
    id: 'agent-supervisor',
    name: 'Supervisor Orchestrator',
    role: 'Central Dispatcher & State Coordinator',
    type: 'supervisor',
    status: 'idle',
    description: 'Directs multi-agent workflows, evaluates termination criteria, and transitions execution state across nodes.',
    model: 'gemini-2.5-flash',
    tools: ['route_to_agent', 'evaluate_completion', 'merge_state_channels', 'inspect_checkpoints'],
    inputChannel: 'task_graph_input',
    outputChannel: 'dispatch_action',
    tasksCompleted: 0,
    activeTask: undefined,
    successRate: 0,
  },
  {
    id: 'agent-researcher',
    name: 'Research Specialist',
    role: 'Deep Technical & Context Synthesizer',
    type: 'researcher',
    status: 'idle',
    description: 'Analyzes technical specifications, evaluates architecture trade-offs, and extracts evidence-backed patterns.',
    model: 'gemini-2.5-flash',
    tools: ['technical_dossier_query', 'benchmark_analyzer', 'citation_validator', 'extract_tradeoffs'],
    inputChannel: 'research_query',
    outputChannel: 'research_dossier',
    tasksCompleted: 0,
    activeTask: undefined,
    successRate: 0,
  },
  {
    id: 'agent-planner',
    name: 'Planner Architect',
    role: 'Objective Decomposition & DAG Modeler',
    type: 'planner',
    status: 'idle',
    description: 'Transforms high-level objectives into sequential milestones, dependency graphs, and resource estimates.',
    model: 'gemini-2.5-flash',
    tools: ['decompose_objective', 'generate_milestones', 'calculate_critical_path', 'detect_cycles'],
    inputChannel: 'project_goal',
    outputChannel: 'milestone_manifest',
    tasksCompleted: 0,
    activeTask: undefined,
    successRate: 0,
  },
  {
    id: 'agent-python-planner',
    name: 'Python Gemini Planning Agent',
    role: 'Structured Planning & Reasoning Assistance',
    type: 'python_planner',
    status: 'idle',
    description: 'Calls the FastAPI planning service and uses google-genai to produce structured tasks, risks, sequences, and next actions.',
    model: 'gemini-2.5-flash (FastAPI)',
    tools: ['fastapi_agent_run', 'structured_planning', 'gemini_retry'],
    inputChannel: 'python_planning_request',
    outputChannel: 'structured_plan',
    tasksCompleted: 0,
    activeTask: undefined,
    successRate: 0,
  },
  {
    id: 'agent-coder',
    name: 'Code Generator',
    role: 'FastAPI & Implementation Synthesizer',
    type: 'coder',
    status: 'idle',
    description: 'Implements typed endpoints, Pydantic schemas, database models, and client API contracts.',
    model: 'gemini-2.5-flash',
    tools: ['generate_pydantic_schema', 'scaffold_fastapi_route', 'implement_langgraph_node', 'format_code'],
    inputChannel: 'spec_manifest',
    outputChannel: 'code_artifacts',
    tasksCompleted: 0,
    activeTask: undefined,
    successRate: 0,
  },
  {
    id: 'agent-reviewer',
    name: 'QA & Verification Guard',
    role: 'Security & Quality Validator',
    type: 'reviewer',
    status: 'idle',
    description: 'Enforces schema validation, tests edge case scenarios, and evaluates compliance before task completion.',
    model: 'gemini-2.5-flash',
    tools: ['verify_schema_contract', 'check_jwt_guards', 'run_pytest_suite', 'audit_performance'],
    inputChannel: 'code_and_plan_artifacts',
    outputChannel: 'qa_verdict',
    tasksCompleted: 0,
    activeTask: undefined,
    successRate: 0,
  },
];

export const RECENT_AGENT_RUNS: AgentRunLog[] = [];

class AgentRegistryService {
  private agents: Agent[] = [...INITIAL_AGENTS];
  private runs: AgentRunLog[] = [...RECENT_AGENT_RUNS];

  public getAgents(): Agent[] {
    return [...this.agents];
  }

  public getAgentById(id: string): Agent | undefined {
    return this.agents.find((a) => a.id === id);
  }

  public getRecentRuns(): AgentRunLog[] {
    return [...this.runs];
  }

  public updateAgentStatus(id: string, status: Agent['status'], activeTask?: string): void {
    this.agents = this.agents.map((a) =>
      a.id === id
        ? {
            ...a,
            status,
            activeTask: activeTask !== undefined ? activeTask : a.activeTask,
            lastRun: status === 'running' ? new Date().toISOString() : a.lastRun,
          }
        : a
    );
  }

  public addRunLog(run: AgentRunLog): void {
    this.runs = [run, ...this.runs.slice(0, 49)];
  }
}

export const agentRegistry = new AgentRegistryService();
