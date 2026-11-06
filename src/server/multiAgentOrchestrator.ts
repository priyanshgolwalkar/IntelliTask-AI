import { GoogleGenAI } from '@google/genai';
import { LLMProviderManager } from './llmProviderManager';

export interface SearchResultItem {
  title: string;
  snippet: string;
  link: string;
  source: 'duckduckgo' | 'wikipedia';
}

export interface SearchToolResponse {
  query: string;
  results: SearchResultItem[];
  source: 'duckduckgo' | 'wikipedia' | 'duckduckgo+wikipedia' | 'none';
  timestamp: string;
  errors: string[];
}

export interface AgentExecutionLogEntry {
  id: string;
  agentId: 'manager' | 'researcher' | 'planner' | 'python_planner';
  agentName: string;
  action: string;
  decision: string;
  toolName?: string;
  toolInput?: any;
  toolOutput?: any;
  status: 'success' | 'running' | 'failed';
  timestamp: string;
  providerMetadata?: {
    provider: 'gemini' | 'groq';
    model: string;
    fallbackReason?: string;
    durationMs: number;
  };
}

export interface MultiAgentResult {
  runId: string;
  userGoal: string;
  managerDirective: string;
  researchDossier: any;
  planManifest: any;
  pythonPlanning: any;
  executionLogs: AgentExecutionLogEntry[];
  sharedStateSnapshot: {
    stateChannels: Record<string, any>;
    delegationTrail: string[];
    toolsExecuted: string[];
  };
  completedAt: string;
}

function jsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function isTemporaryGeminiError(error: unknown): boolean {
  const statusCode = Number(
    typeof error === 'object' && error && 'status' in error
      ? (error as { status?: number }).status
      : typeof error === 'object' && error && 'statusCode' in error
        ? (error as { statusCode?: number }).statusCode
        : 0,
  );
  const message = error instanceof Error ? error.message : String(error || '');
  return [429, 500, 502, 503].includes(statusCode) ||
    /429|500|502|503|UNAVAILABLE|RESOURCE_EXHAUSTED|ECONNRESET|ETIMEDOUT|fetch failed|network/i.test(message);
}

export async function generateContentWithFallback(
  ai: GoogleGenAI | undefined,
  options: { contents: any; config?: any; preferredModel?: string },
  agentName = 'LLM Agent',
) {
  const manager = new LLMProviderManager(ai);
  const result = await manager.generate({
    agentName,
    contents: options.contents,
    config: options.config,
  });
  return {
    text: result.text,
    provider: result.provider,
    model: result.model,
    providerMetadata: result.metadata,
  };
}

export async function executeDuckDuckGoSearch(query: string, limit = 5): Promise<SearchToolResponse> {
  const cleanQuery = query.trim();
  const errors: string[] = [];
  const results: SearchResultItem[] = [];

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const ddgUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&format=json&no_html=1&skip_disambig=1`;
    const response = await fetch(ddgUrl, {
      headers: { 'User-Agent': 'IntelliTask-AI/1.0' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`DuckDuckGo HTTP ${response.status}`);
    const json: any = await response.json();
    if (json.AbstractText && json.AbstractURL) {
      results.push({
        title: json.Heading || cleanQuery,
        snippet: json.AbstractText,
        link: json.AbstractURL,
        source: 'duckduckgo',
      });
    }
    const collect = (items: any[]) => {
      for (const item of items) {
        if (results.length >= limit) break;
        if (item?.Text && item?.FirstURL) {
          if (!results.some((result) => result.link === item.FirstURL)) {
            results.push({
              title: String(item.Text).slice(0, 120),
              snippet: String(item.Text),
              link: item.FirstURL,
              source: 'duckduckgo',
            });
          }
        }
        if (Array.isArray(item?.Topics)) collect(item.Topics);
      }
    };
    collect(Array.isArray(json.RelatedTopics) ? json.RelatedTopics : []);
  } catch (error: any) {
    errors.push(`DuckDuckGo unavailable: ${error?.name === 'AbortError' ? 'timeout' : error?.message || String(error)}`);
  }

  if (results.length < limit) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      const response = await fetch(
        `https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`,
        { headers: { 'User-Agent': 'Mozilla/5.0 IntelliTask-AI/1.0' }, signal: controller.signal },
      );
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`DuckDuckGo HTML HTTP ${response.status}`);
      const html = await response.text();
      const resultLinkPattern = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      const snippetPattern = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<div[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/div>/gi;
      const links = [...html.matchAll(resultLinkPattern)];
      const snippets = [...html.matchAll(snippetPattern)];
      const stripHtml = (value: string) =>
        value.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
          .replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

      for (let index = 0; index < links.length && results.length < limit; index++) {
        const linkMatch = links[index];
        let link = stripHtml(linkMatch[1]);
        try {
          const redirectUrl = new URL(link, 'https://html.duckduckgo.com');
          if (redirectUrl.searchParams.has('uddg')) {
            link = redirectUrl.searchParams.get('uddg') || link;
          }
        } catch {
          // Keep the original matched URL if it cannot be parsed.
        }
        if (!link || results.some((result) => result.link === link)) continue;
        const title = stripHtml(linkMatch[2]);
        const snippet = snippets[index] ? stripHtml(snippets[index][1] || snippets[index][2] || '') : '';
        results.push({
          title: title || cleanQuery,
          snippet: snippet || `DuckDuckGo result for ${cleanQuery}`,
          link,
          source: 'duckduckgo',
        });
      }
    } catch (error: any) {
      errors.push(`DuckDuckGo HTML unavailable: ${error?.name === 'AbortError' ? 'timeout' : error?.message || String(error)}`);
    }
  }

  if (results.length < limit) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);
      const response = await fetch(
        `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(cleanQuery)}&limit=${limit}&namespace=0&format=json`,
        { headers: { 'User-Agent': 'IntelliTask-AI/1.0' }, signal: controller.signal },
      );
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`Wikipedia HTTP ${response.status}`);
      const [, titles, descriptions, links]: [string, string[], string[], string[]] = await response.json();
      for (let index = 0; index < titles.length && results.length < limit; index++) {
        if (!links[index] || results.some((result) => result.link === links[index])) continue;
        results.push({
          title: titles[index],
          snippet: descriptions[index] || `Wikipedia reference for ${titles[index]}`,
          link: links[index],
          source: 'wikipedia',
        });
      }
    } catch (error: any) {
      errors.push(`Wikipedia unavailable: ${error?.name === 'AbortError' ? 'timeout' : error?.message || String(error)}`);
    }
  }

  const sources = [...new Set(results.map((result) => result.source))];
  const source = sources.length === 0 ? 'none' : sources.length === 2 ? 'duckduckgo+wikipedia' : sources[0];
  return {
    query: cleanQuery,
    results: results.slice(0, limit),
    source,
    timestamp: new Date().toISOString(),
    errors,
  };
}

export function executeCalculateSchedule(params: {
  startDate?: string;
  horizonDays?: number;
  milestoneCount?: number;
  milestoneTitles?: string[];
}) {
  const start = new Date(params.startDate || new Date().toISOString().slice(0, 10));
  if (Number.isNaN(start.getTime())) throw new Error('Invalid startDate');
  const horizonDays = Math.max(1, Math.min(params.horizonDays ?? 14, 90));
  const milestoneCount = Math.max(1, Math.min(params.milestoneCount ?? 3, 8));
  let workingDays = 0;
  for (let offset = 0; offset < horizonDays; offset++) {
    const day = new Date(start);
    day.setDate(start.getDate() + offset);
    if (day.getDay() !== 0 && day.getDay() !== 6) workingDays++;
  }
  const daysPerMilestone = Math.max(1, Math.floor(horizonDays / milestoneCount));
  const calculatedMilestones = Array.from({ length: milestoneCount }, (_, index) => {
    const offset = Math.min((index + 1) * daysPerMilestone, horizonDays);
    const target = new Date(start);
    target.setDate(start.getDate() + offset);
    return {
      index: index + 1,
      title: params.milestoneTitles?.[index] || `Execution phase ${index + 1}`,
      targetDate: target.toISOString().slice(0, 10),
      workingDaysFromStart: Math.max(0, offset),
      estimatedHours: Math.max(4, Math.round((workingDays / milestoneCount) * 6)),
    };
  });
  return {
    startDate: start.toISOString().slice(0, 10),
    horizonDays,
    workingDays,
    calculatedMilestones,
    criticalPathBufferDays: Math.max(1, Math.floor(horizonDays * 0.15)),
    calculatedAt: new Date().toISOString(),
  };
}

async function callPythonPlanningAgent(objective: string, context: string, horizonDays: number) {
  const baseUrl = (process.env.FASTAPI_URL || 'http://localhost:8000').replace(/\/$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.FASTAPI_TIMEOUT_MS || 35000));
  try {
    const response = await fetch(`${baseUrl}/api/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objective, context, horizon_days: horizonDays }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return { connected: false, result: null, error: data?.detail || `FastAPI HTTP ${response.status}` };
    }
    return { connected: true, result: data?.result || null, error: null, model: data?.model, provider: data?.provider, retries: data?.retries || 0 };
  } catch (error: any) {
    return {
      connected: false,
      result: null,
      error: error?.name === 'AbortError' ? 'Python planning agent timed out' : error?.message || String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runMultiAgentOrchestration(
  ai: GoogleGenAI | undefined,
  params: { userGoal: string; userId: string; memoryContext?: string[]; horizonDays?: number },
): Promise<MultiAgentResult> {
  const runId = `run_${Date.now().toString(36)}`;
  const horizonDays = Math.max(1, Math.min(params.horizonDays ?? 14, 90));
  const logs: AgentExecutionLogEntry[] = [];
  const delegationTrail = ['user -> manager'];
  const toolsExecuted: string[] = [];
  const stateChannels: Record<string, any> = {
    userGoal: params.userGoal,
    userId: params.userId,
    agentMemory: params.memoryContext || [],
  };
  const log = (
    agentId: AgentExecutionLogEntry['agentId'],
    agentName: string,
    action: string,
    decision: string,
    status: AgentExecutionLogEntry['status'] = 'success',
    extra: Partial<AgentExecutionLogEntry> = {},
  ) => logs.push({
    id: `log_${runId}_${logs.length + 1}`,
    agentId,
    agentName,
    action,
    decision,
    status,
    timestamp: new Date().toISOString(),
    ...extra,
  });

  const needsResearch = /\bresearch\b|\blatest\b|\bdevelopments\b|\bcareer\b|\bskills\b|\bcloud computing\b|\bgenerative ai\b/i.test(params.userGoal);
  let researchDossier: any = {
    topic: params.userGoal,
    executiveSummary: needsResearch ? 'Live research was requested, but external research is reported separately.' : 'Research is not required for this objective.',
    keyFindings: [],
    sources: [],
    confidenceScore: 0,
  };
  let searchResults: SearchToolResponse | null = null;

  log('manager', 'Manager Agent', 'Analyze objective and select delegation path',
    needsResearch
      ? 'Delegate to Researcher, then Planner and Python Planning Agent.'
      : 'Delegate directly to Planner, with Python planning assistance; external research can be skipped.');

  if (needsResearch) {
    delegationTrail.push('manager -> researcher');
    searchResults = await executeDuckDuckGoSearch(params.userGoal, 5);
    toolsExecuted.push('duckduckgo_search');
    if (searchResults.results.some((item) => item.source === 'wikipedia')) toolsExecuted.push('wikipedia_fallback');

    log('researcher', 'Researcher Agent', 'Retrieve grounded external sources',
      `Retrieved ${searchResults.results.length} source(s) from ${searchResults.source}.`,
      searchResults.results.length ? 'success' : 'failed',
      { toolName: 'web_search', toolInput: { query: params.userGoal }, toolOutput: searchResults },
    );

    const synthesisPrompt = `You are the IntelliTask Researcher Agent.
Objective: ${params.userGoal}
Memory: ${jsonText(params.memoryContext || [])}
Verified sources: ${jsonText(searchResults.results)}

Use only the supplied sources. Never invent URLs or findings.
Return ONLY valid JSON:
{"topic":string,"executiveSummary":string,"keyFindings":string[],"technicalRecommendations":[{"area":string,"recommendation":string,"rationale":string}],"confidenceScore":number,"sources":[{"title":string,"url":string,"source":string}]}`;

    try {
      const response = await generateContentWithFallback(ai, {
        contents: synthesisPrompt,
        config: { responseMimeType: 'application/json' },
      });
      researchDossier = JSON.parse((response.text || '{}').replace(/```json|```/g, '').trim());
      researchDossier.sources = searchResults.results.map((item) => ({
        title: item.title, url: item.link, source: item.source,
      }));
      researchDossier.provider = {
        provider: response.provider,
        model: response.model,
        fallbackReason: response.providerMetadata.fallbackReason,
      };
    } catch (error: any) {
      researchDossier = {
        topic: params.userGoal,
        executiveSummary: searchResults.results.length
          ? 'External sources were retrieved, but Gemini synthesis was unavailable.'
          : 'No external sources were retrieved and Gemini synthesis was unavailable.',
        keyFindings: searchResults.results.map((item) => item.snippet),
        technicalRecommendations: [],
        confidenceScore: searchResults.results.length ? 40 : 0,
        sources: searchResults.results.map((item) => ({ title: item.title, url: item.link, source: item.source })),
        errors: [error?.message || String(error)],
      };
    }
    stateChannels.researchDossier = researchDossier;
  }

  delegationTrail.push(needsResearch ? 'researcher -> planner' : 'manager -> planner');
  const schedule = executeCalculateSchedule({
    horizonDays,
    milestoneCount: horizonDays <= 7 ? 3 : 5,
  });
  toolsExecuted.push('calculate_schedule');
  log('planner', 'Planner Agent', 'Convert objective and research context into a schedule',
    `Calculated ${schedule.workingDays} working days over ${schedule.horizonDays} calendar days.`,
    'success', { toolName: 'calculate_schedule', toolInput: { horizonDays }, toolOutput: schedule });

  const pythonPlanning = await callPythonPlanningAgent(
    params.userGoal,
    `Research: ${jsonText(researchDossier)}\nSchedule: ${jsonText(schedule)}\nMemory: ${jsonText(params.memoryContext || [])}`,
    horizonDays,
  );
  delegationTrail.push('planner -> python_planner');
  log('python_planner', 'Python Gemini Planning Agent', 'Request structured planning assistance from FastAPI',
    pythonPlanning.connected
      ? 'FastAPI returned a structured Gemini planning result.'
      : `FastAPI planning assistance unavailable: ${pythonPlanning.error}`,
    pythonPlanning.connected ? 'success' : 'failed',
    { toolName: 'fastapi_agent_run', toolInput: { horizonDays }, toolOutput: pythonPlanning });

  const plannerPrompt = `You are the IntelliTask Planner Agent.
Create an actionable plan for this objective: ${params.userGoal}
Research context: ${jsonText(researchDossier)}
Python planning context: ${jsonText(pythonPlanning.result)}
Schedule: ${jsonText(schedule)}
Horizon: ${horizonDays} days.
Return exactly ${horizonDays} unique actionable daily tasks, Day 1 through Day ${horizonDays}, with one task per day.
Do not duplicate tasks. Every task needs title, description, priority, estimatedHours, and dependencies.
Keep estimatedDays and deadlines consistent with ${horizonDays} days.

Return ONLY valid JSON:
{"title":string,"summary":string,"estimatedDays":number,"riskLevel":"Low"|"Medium"|"High","milestones":[{"id":string,"title":string,"description":string,"dayOffset":number,"tasks":[{"title":string,"description":string,"priority":"low"|"medium"|"high"|"urgent","estimatedHours":number,"recommendedAgent":string,"dependencies":string[]}]}],"criticalRisks":string[]}`;

  let planManifest: any = {
    title: params.userGoal,
    summary: pythonPlanning.result?.summary || 'The plan could not be generated by Gemini.',
    estimatedDays: horizonDays,
    riskLevel: pythonPlanning.connected ? 'Medium' : 'High',
    milestones: [],
    criticalRisks: pythonPlanning.result?.risks || [pythonPlanning.error || 'Planning assistance unavailable'],
  };
  try {
    const response = await generateContentWithFallback(ai, {
      contents: plannerPrompt,
      config: { responseMimeType: 'application/json' },
    });
    planManifest = JSON.parse((response.text || '{}').replace(/```json|```/g, '').trim());
    planManifest.provider = {
      provider: response.provider,
      model: response.model,
      fallbackReason: response.providerMetadata.fallbackReason,
    };
  } catch (error: any) {
    planManifest.errors = [error?.message || String(error)];
    planManifest.milestones = (pythonPlanning.result?.tasks || []).length
      ? [{ id: 'M1', title: 'Python planning agent tasks', description: 'Tasks returned by the FastAPI planning service.', dayOffset: horizonDays, tasks: pythonPlanning.result.tasks.map((task: any) => ({
          title: task.title,
          description: task.description || '',
          priority: task.priority || 'medium',
          estimatedHours: task.estimatedHours || 4,
          recommendedAgent: 'Planner Architect',
          dependencies: task.dependencies || [],
        })) }]
      : [];
  }
  stateChannels.planManifest = planManifest;
  stateChannels.pythonPlanning = pythonPlanning;
  delegationTrail.push('python_planner -> manager');

  let managerDirective = 'The workflow could not be reviewed because Gemini is unavailable.';
  try {
    const response = await generateContentWithFallback(ai, {
      contents: `You are the Manager Agent. Consolidate and evaluate this workflow.
Objective: ${params.userGoal}
Research: ${jsonText(researchDossier)}
Plan: ${jsonText(planManifest)}
Python planning: ${jsonText(pythonPlanning)}
Return 2 concise paragraphs: approval or limitations, primary priority, and first actionable instruction. Do not claim unverified research or successful services.`,
    });
    managerDirective = response.text?.trim() || managerDirective;
  } catch (error: any) {
    managerDirective = `Planning completed with available components, but final Gemini review was unavailable: ${error?.message || String(error)}`;
  }

  log('manager', 'Manager Agent', 'Evaluate outputs and issue consolidated result',
    'Collected researcher sources, schedule, TypeScript plan, and Python planning output before finalizing.',
    'success');

  return {
    runId,
    userGoal: params.userGoal,
    managerDirective,
    researchDossier,
    planManifest,
    pythonPlanning,
    executionLogs: logs,
    sharedStateSnapshot: { stateChannels, delegationTrail, toolsExecuted },
    completedAt: new Date().toISOString(),
  };
}
