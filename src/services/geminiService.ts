import { GeneratedPlan, ResearchDossier, SystemHealth } from '../types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  status?: 'sent' | 'received' | 'error';
}

export function normalizeResearchDossier(value: unknown, topic: string, researchedAt?: string): ResearchDossier {
  const raw = value && typeof value === 'object' ? value as Record<string, any> : {};
  const stringArray = (items: unknown) =>
    Array.isArray(items) ? items.filter((item): item is string => typeof item === 'string') : [];

  return {
    topic: typeof raw.topic === 'string' && raw.topic.trim() ? raw.topic : topic,
    executiveSummary: typeof raw.executiveSummary === 'string'
      ? raw.executiveSummary
      : 'No research synthesis was returned.',
    keyFindings: stringArray(raw.keyFindings),
    architecturalPatterns: Array.isArray(raw.architecturalPatterns)
      ? raw.architecturalPatterns.filter((pattern: any) =>
          pattern && typeof pattern === 'object'
        ).map((pattern: any) => ({
          patternName: typeof pattern.patternName === 'string' ? pattern.patternName : 'Unnamed pattern',
          pros: stringArray(pattern.pros),
          cons: stringArray(pattern.cons),
          recommendedWhen: typeof pattern.recommendedWhen === 'string' ? pattern.recommendedWhen : '',
        }))
      : [],
    technicalRecommendations: Array.isArray(raw.technicalRecommendations)
      ? raw.technicalRecommendations.filter((recommendation: any) =>
          recommendation && typeof recommendation === 'object'
        ).map((recommendation: any) => ({
          area: typeof recommendation.area === 'string' ? recommendation.area : '',
          recommendation: typeof recommendation.recommendation === 'string'
            ? recommendation.recommendation
            : '',
          rationale: typeof recommendation.rationale === 'string' ? recommendation.rationale : '',
        }))
      : [],
    implementationRoadmap: Array.isArray(raw.implementationRoadmap)
      ? raw.implementationRoadmap.filter((phase: any) => phase && typeof phase === 'object')
        .map((phase: any) => ({
          phase: typeof phase.phase === 'string' ? phase.phase : '',
          deliverables: stringArray(phase.deliverables),
        }))
      : [],
    confidenceScore: Number.isFinite(Number(raw.confidenceScore))
      ? Math.max(0, Math.min(100, Number(raw.confidenceScore)))
      : 0,
    suggestedTasks: Array.isArray(raw.suggestedTasks)
      ? raw.suggestedTasks.filter((task: any) => task && typeof task === 'object')
        .map((task: any) => ({
          title: typeof task.title === 'string' ? task.title : '',
          priority: ['low', 'medium', 'high', 'urgent'].includes(task.priority) ? task.priority : 'medium',
          assignedAgent: typeof task.assignedAgent === 'string' ? task.assignedAgent : 'Unassigned',
        })).filter((task: any) => task.title)
      : [],
    researchedAt,
  };
}

export function normalizeOrchestrationResult(value: unknown): Record<string, any> | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, any>;
  const planManifest = raw.planManifest && typeof raw.planManifest === 'object'
    ? {
        ...raw.planManifest,
        milestones: Array.isArray(raw.planManifest.milestones)
          ? raw.planManifest.milestones.filter((milestone: unknown) => milestone && typeof milestone === 'object')
          : [],
        criticalRisks: Array.isArray(raw.planManifest.criticalRisks)
          ? raw.planManifest.criticalRisks.filter((risk: unknown) => typeof risk === 'string')
          : [],
      }
    : null;

  return {
    ...raw,
    runId: typeof raw.runId === 'string' ? raw.runId : null,
    managerDirective: typeof raw.managerDirective === 'string' ? raw.managerDirective : '',
    researchDossier: raw.researchDossier && typeof raw.researchDossier === 'object'
      ? raw.researchDossier
      : null,
    planManifest,
    executionLogs: Array.isArray(raw.executionLogs)
      ? raw.executionLogs.filter((log: unknown) => log && typeof log === 'object')
      : [],
  };
}

export function normalizeGeneratedPlan(value: unknown, horizonDays?: number): GeneratedPlan {
  if (!value || typeof value !== 'object') {
    throw new Error('Planner response is missing the required plan object.');
  }
  const raw = value as Record<string, any>;
  if (typeof raw.title !== 'string' || !raw.title.trim()) {
    throw new Error('Planner response is missing a valid plan title.');
  }
  if (typeof raw.summary !== 'string' || !raw.summary.trim()) {
    throw new Error('Planner response is missing a valid plan summary.');
  }
  if (!Array.isArray(raw.milestones)) {
    throw new Error('Planner response is missing the milestones array.');
  }

  const milestones = raw.milestones.map((milestone: any, milestoneIndex: number) => {
    if (!milestone || typeof milestone !== 'object') {
      throw new Error(`Planner milestone at index ${milestoneIndex} is malformed.`);
    }
    const tasks = Array.isArray(milestone.tasks) ? milestone.tasks.map((task: any, taskIndex: number) => {
      if (!task || typeof task !== 'object') {
        throw new Error(`Task at milestone ${milestoneIndex}, index ${taskIndex} is malformed.`);
      }
      return {
        title: typeof task.title === 'string' ? task.title : '',
        description: typeof task.description === 'string' ? task.description : '',
        priority: ['low', 'medium', 'high', 'urgent'].includes(task.priority) ? task.priority : 'medium',
        estimatedHours: Number.isFinite(Number(task.estimatedHours)) ? Number(task.estimatedHours) : 4,
        recommendedAgent: typeof task.recommendedAgent === 'string' ? task.recommendedAgent : 'Unassigned',
        dependencies: Array.isArray(task.dependencies)
          ? task.dependencies.filter((dependency: unknown) => typeof dependency === 'string')
          : [],
      };
    }) : [];

    return {
      id: typeof milestone.id === 'string' ? milestone.id : `M${milestoneIndex + 1}`,
      title: typeof milestone.title === 'string' ? milestone.title : '',
      description: typeof milestone.description === 'string' ? milestone.description : '',
      dayOffset: Number.isFinite(Number(milestone.dayOffset)) ? Number(milestone.dayOffset) : 0,
      tasks,
    };
  });

  const flattenedTasks: Array<Record<string, any>> = [];
  for (const milestone of milestones) {
    flattenedTasks.push(...milestone.tasks.map((task: any) => ({
      title: task.title,
      description: task.description,
      priority: task.priority,
      estimatedHours: task.estimatedHours,
      recommendedAgent: task.recommendedAgent,
      dependencies: task.dependencies,
    })));
  }

  const expectedHorizon = Number.isFinite(Number(horizonDays))
    ? Math.max(1, Math.min(Number(horizonDays), 90))
    : undefined;

  let dailyMilestones = milestones;
  if (expectedHorizon !== undefined) {
    const uniqueTasks = flattenedTasks.filter((task, index, tasks) => {
      const title = String(task.title || '').trim().toLowerCase();
      return title && tasks.findIndex((candidate) => String(candidate.title || '').trim().toLowerCase() === title) === index;
    });
    if (uniqueTasks.length !== expectedHorizon) {
      throw new Error(
        `Planner response contains ${uniqueTasks.length} unique tasks for a ${expectedHorizon}-day horizon; exactly ${expectedHorizon} daily tasks are required.`,
      );
    }
    if (uniqueTasks.some((task) => !String(task.description || '').trim())) {
      throw new Error('Planner response contains an incomplete daily task: missing description.');
    }
    if (uniqueTasks.some((task) => !Number.isFinite(Number(task.estimatedHours)) || Number(task.estimatedHours) <= 0)) {
      throw new Error('Planner response contains an incomplete daily task: missing estimated hours.');
    }
    dailyMilestones = uniqueTasks.map((task, dayIndex) => ({
      id: `DAY-${dayIndex + 1}`,
      title: `Day ${dayIndex + 1}: ${task.title}`,
      description: task.description,
      dayOffset: dayIndex + 1,
      tasks: [{
        title: task.title,
        description: task.description,
        priority: ['low', 'medium', 'high', 'urgent'].includes(task.priority) ? task.priority : 'medium',
        estimatedHours: Number(task.estimatedHours),
        recommendedAgent: task.recommendedAgent || 'Unassigned',
        dependencies: task.dependencies || [],
      }],
    }));
  }

  return {
    title: raw.title.trim(),
    summary: raw.summary.trim(),
    estimatedDays: expectedHorizon ?? (Number.isFinite(Number(raw.estimatedDays)) ? Number(raw.estimatedDays) : 0),
    riskLevel: raw.riskLevel === 'High' ? 'High' : raw.riskLevel === 'Low' ? 'Low' : 'Medium',
    milestones: dailyMilestones,
    langGraphExecutionNodes: Array.isArray(raw.langGraphExecutionNodes)
      ? raw.langGraphExecutionNodes.filter((node: any) =>
          node && typeof node === 'object' &&
          typeof node.nodeName === 'string'
        )
      : [],
    criticalRisks: Array.isArray(raw.criticalRisks)
      ? raw.criticalRisks.filter((risk: unknown) => typeof risk === 'string')
      : [],
  };
}

export class GeminiService {
  /**
   * Check real server status and whether Gemini API key is configured
   */
  public async getHealth(): Promise<SystemHealth> {
    try {
      const res = await fetch('/api/health');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      return {
        serverConnected: true,
        geminiConfigured: Boolean(data.geminiConfigured),
        fastApiConnected: false, // will be verified separately
        lastChecked: new Date().toISOString(),
      };
    } catch {
      return {
        serverConnected: false,
        geminiConfigured: false,
        fastApiConnected: false,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  /**
   * Real AI Assistant chat request via Gemini server-side proxy
   */
  public async sendAssistantMessage(
    messages: { role: string; content: string }[],
    systemRole: string,
    contextData?: any
  ): Promise<{ reply: string; timestamp: string }> {
    const res = await fetch('/api/assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, systemRole, contextData }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || `Error ${res.status}: Request failed`);
    }
    return data;
  }

  /**
   * Real Autonomous AI Planner decomposition via Gemini server-side proxy
   */
  public async generatePlan(params: {
    objective: string;
    techStack: string;
    constraints: string;
    teamSize: string;
    horizonDays: number;
  }): Promise<{
    plan: GeneratedPlan;
    generatedAt: string;
    source: string;
    provider?: string | null;
    model?: string | null;
    warnings?: string[];
    fastApi?: { connected: boolean; model?: string | null; retries?: number; error?: string };
  }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);
    let res: Response;
    let data: any;
    try {
      res = await fetch('/api/planner/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: controller.signal,
      });
      data = await res.json().catch(() => null);
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error('Planner request timed out after 55 seconds. Check FastAPI and Gemini availability, then retry.');
      }
      throw new Error(error?.message || 'Unable to reach the Planner API.');
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) {
      throw new Error(
        `${data?.failedAgent ? `${data.failedAgent}: ` : ''}${data?.message || data?.error || `Plan generation failed (${res.status})`}`
      );
    }

    return {
      ...data,
      plan: normalizeGeneratedPlan(data?.plan, params.horizonDays),
      warnings: Array.isArray(data?.warnings)
        ? data.warnings.filter((warning: unknown) => typeof warning === 'string')
        : [],
    };
  }

  /**
   * Real Deep Research Query via Gemini server-side proxy
   */
  public async queryResearch(params: {
    topic: string;
    depth: string;
    focusAreas: string[];
  }): Promise<{ dossier: ResearchDossier; researchedAt: string; engine: string }> {
    const res = await fetch('/api/research/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || `Research query failed (${res.status})`);
    }

    return {
      ...data,
      dossier: normalizeResearchDossier(data?.dossier, params.topic, data?.researchedAt),
    };
  }

  /**
   * Real Multi-Agent Orchestration (Manager -> Researcher -> Planner)
   */
  public async orchestrateMultiAgent(params: {
    userGoal: string;
    userId: string;
    memoryContext?: string[];
    horizonDays?: number;
  }): Promise<{
    runId: string;
    userGoal: string;
    managerDirective: string;
    researchDossier: any;
    planManifest: any;
    executionLogs: any[];
    sharedStateSnapshot: any;
    completedAt: string;
  }> {
    const res = await fetch('/api/agents/orchestrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || `Orchestration failed (${res.status})`);
    }

    return normalizeOrchestrationResult(data) as {
      runId: string;
      userGoal: string;
      managerDirective: string;
      researchDossier: any;
      planManifest: any;
      executionLogs: any[];
      sharedStateSnapshot: any;
      completedAt: string;
    };
  }

  /**
   * Real DuckDuckGo Web Search Tool
   */
  public async searchWeb(query: string, limit = 5): Promise<{
    query: string;
    results: { title: string; snippet: string; link: string }[];
    source: string;
    timestamp: string;
  }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch('/api/tools/web-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), limit }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error || `Web search failed (${res.status})`);
      }
      return {
        query: typeof data?.query === 'string' ? data.query : query.trim(),
        results: Array.isArray(data?.results)
          ? data.results.filter((result: any) =>
              result &&
              typeof result.title === 'string' &&
              typeof result.snippet === 'string' &&
              typeof result.link === 'string'
            )
          : [],
        source: typeof data?.source === 'string' ? data.source : 'none',
        timestamp: typeof data?.timestamp === 'string' ? data.timestamp : '',
      };
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw new Error('Web search timed out. Please try again.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Real Task Scheduling & Deadline Calculation Tool
   */
  public async calculateSchedule(params: {
    startDate?: string;
    horizonDays?: number;
    milestoneCount?: number;
    milestoneTitles?: string[];
  }): Promise<{
    startDate: string;
    horizonDays: number;
    workingDays: number;
    calculatedMilestones: any[];
    criticalPathBufferDays: number;
    calculatedAt: string;
  }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    let res: Response;
    let data: any;
    try {
      res = await fetch('/api/tools/calculate-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
        signal: controller.signal,
      });
      data = await res.json().catch(() => null);
    } catch (error: any) {
      throw new Error(error?.name === 'AbortError'
        ? 'Schedule calculation timed out after 10 seconds.'
        : error?.message || 'Unable to reach the Schedule API.');
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) {
      throw new Error(data.error || `Schedule calculation failed (${res.status})`);
    }

    return data;
  }
}

export const geminiService = new GeminiService();
