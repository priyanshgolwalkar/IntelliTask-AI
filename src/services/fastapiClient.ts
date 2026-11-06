import { FastAPISettings } from '../types';

export const DEFAULT_FASTAPI_SETTINGS: FastAPISettings = {
  baseUrl: 'http://localhost:8000',
  apiKey: '',
  graphId: 'intellitask_core_graph',
  timeoutSeconds: 15,
  streamLogs: true,
  autoSyncTasks: false,
};

export interface ConnectionTestResult {
  connected: boolean;
  endpoint: string;
  latencyMs?: number;
  statusCode?: number;
  message?: string;
  error?: string;
  recommendation?: string;
  timestamp: string;
}

/**
 * Client service designed to communicate with a Python FastAPI + LangGraph service.
 * Ready for drop-in orchestration with standard LangGraph endpoints:
 * - GET /health
 * - POST /api/v1/graphs/{graph_id}/run
 * - GET /api/v1/graphs/{graph_id}/state
 * - POST /api/v1/tasks/sync
 */
export class FastAPILangGraphClient {
  private settings: FastAPISettings;

  constructor(settings?: FastAPISettings) {
    this.settings = settings || this.loadSettings();
  }

  public loadSettings(): FastAPISettings {
    try {
      const stored = localStorage.getItem('intellitask_fastapi_settings');
      if (stored) {
        return { ...DEFAULT_FASTAPI_SETTINGS, ...JSON.parse(stored) };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_FASTAPI_SETTINGS;
  }

  public saveSettings(settings: FastAPISettings): void {
    this.settings = settings;
    try {
      localStorage.setItem('intellitask_fastapi_settings', JSON.stringify(settings));
    } catch {
      // storage quota or private mode
    }
  }

  public getSettings(): FastAPISettings {
    return this.settings;
  }

  /**
   * Tests real connectivity to the Python FastAPI backend via our proxy
   * to avoid CORS and sandbox limitations.
   */
  public async testConnection(customUrl?: string): Promise<ConnectionTestResult> {
    const target = customUrl || this.settings.baseUrl;
    try {
      const res = await fetch('/api/langgraph/check-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpointUrl: target }),
      });

      if (!res.ok) {
        throw new Error(`Server proxy error: HTTP ${res.status}`);
      }

      const data = await res.json();
      return data;
    } catch (err: any) {
      return {
        connected: false,
        endpoint: target,
        error: err.message || 'Network connection failed',
        recommendation:
          'Ensure the local Python FastAPI server is running with CORS enabled (e.g., uvicorn main:app --reload --port 8000).',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Generates the ready-to-run Python FastAPI + LangGraph boilerplate files.
   * This gives developers the exact backend implementation code to copy-paste.
   */
  public getPythonBoilerplateCode(): {
    mainPy: string;
    graphPy: string;
    statePy: string;
    requirementsTxt: string;
  } {
    const mainPy = `# IntelliTask AI - FastAPI Entrypoint
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import uvicorn
from graph import build_intellitask_graph

app = FastAPI(
    title="IntelliTask AI LangGraph Backend",
    version="1.0.0",
    description="Autonomous multi-agent task execution and state graph engine"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Compiled LangGraph instance
task_graph = build_intellitask_graph()

class TaskItem(BaseModel):
    id: str
    title: str
    status: str
    priority: str
    assignedAgent: str

class GraphRunRequest(BaseModel):
    task_id: str
    objective: str
    context: Optional[Dict[str, Any]] = None

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "IntelliTask LangGraph Engine",
        "version": "1.0.0",
        "nodes": ["supervisor", "researcher", "planner", "coder", "reviewer"]
    }

@app.post("/api/v1/graphs/{graph_id}/run")
async def run_graph(graph_id: str, payload: GraphRunRequest):
    initial_state = {
        "task_id": payload.task_id,
        "objective": payload.objective,
        "current_agent": "supervisor",
        "messages": [],
        "artifacts": {},
        "status": "in_progress"
    }
    
    # Execute LangGraph workflow
    final_state = await task_graph.ainvoke(initial_state)
    return {
        "run_id": f"run_{payload.task_id}",
        "graph_id": graph_id,
        "state": final_state
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
`;

    const statePy = `# IntelliTask AI - LangGraph State Definition
from typing import TypedDict, List, Dict, Any, Optional, Annotated
import operator

class AgentMessage(TypedDict):
    role: str
    content: str
    agent: str
    timestamp: str

class IntelliTaskGraphState(TypedDict):
    task_id: str
    objective: str
    current_agent: str
    messages: Annotated[List[AgentMessage], operator.add]
    research_summary: Optional[Dict[str, Any]]
    milestones: Optional[List[Dict[str, Any]]]
    code_artifacts: Optional[Dict[str, str]]
    review_verdict: Optional[str]
    iteration_count: int
    status: str
`;

    const graphPy = `# IntelliTask AI - LangGraph Workflow Definition
from langgraph.graph import StateGraph, END
from state import IntelliTaskGraphState

async def supervisor_node(state: IntelliTaskGraphState):
    """Routes task to appropriate specialized agent based on state."""
    # Orchestration logic
    if not state.get("research_summary"):
        return {"current_agent": "researcher"}
    elif not state.get("milestones"):
        return {"current_agent": "planner"}
    elif not state.get("code_artifacts"):
        return {"current_agent": "coder"}
    elif not state.get("review_verdict"):
        return {"current_agent": "reviewer"}
    return {"current_agent": "completed", "status": "completed"}

async def researcher_node(state: IntelliTaskGraphState):
    # Call search/retrieval tools
    return {
        "research_summary": {"status": "analyzed", "findings": ["Pattern established"]},
        "iteration_count": state.get("iteration_count", 0) + 1
    }

async def planner_node(state: IntelliTaskGraphState):
    # Formulate milestones
    return {
        "milestones": [{"title": "Milestone 1", "complete": False}],
        "iteration_count": state.get("iteration_count", 0) + 1
    }

async def coder_node(state: IntelliTaskGraphState):
    # Generate code artifacts
    return {
        "code_artifacts": {"src/main.ts": "// Generated artifact"},
        "iteration_count": state.get("iteration_count", 0) + 1
    }

async def reviewer_node(state: IntelliTaskGraphState):
    # Validate deliverables
    return {
        "review_verdict": "APPROVED",
        "status": "completed"
    }

def route_next(state: IntelliTaskGraphState):
    agent = state.get("current_agent")
    if agent == "completed":
        return END
    return agent

def build_intellitask_graph():
    workflow = StateGraph(IntelliTaskGraphState)
    workflow.add_node("supervisor", supervisor_node)
    workflow.add_node("researcher", researcher_node)
    workflow.add_node("planner", planner_node)
    workflow.add_node("coder", coder_node)
    workflow.add_node("reviewer", reviewer_node)
    
    workflow.set_entry_point("supervisor")
    workflow.add_conditional_edges("supervisor", route_next)
    workflow.add_edge("researcher", "supervisor")
    workflow.add_edge("planner", "supervisor")
    workflow.add_edge("coder", "supervisor")
    workflow.add_edge("reviewer", "supervisor")
    
    return workflow.compile()
`;

    const requirementsTxt = `fastapi>=0.110.0
uvicorn>=0.28.0
pydantic>=2.6.0
langgraph>=0.0.30
langchain>=0.1.13
langchain-google-genai>=1.0.1
python-dotenv>=1.0.1
`;

    return { mainPy, graphPy, statePy, requirementsTxt };
  }
}

export const fastApiClient = new FastAPILangGraphClient();
