import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import {
  executeDuckDuckGoSearch,
  executeCalculateSchedule,
  runMultiAgentOrchestration,
  generateContentWithFallback,
} from './src/server/multiAgentOrchestrator';
import { LLMProviderManager } from './src/server/llmProviderManager';
import { mergePlannerBatches } from './src/server/plannerBatch';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';
const fastApiUrl = (process.env.FASTAPI_URL || 'http://localhost:8000').replace(/\/$/, '');

app.use(express.json({ limit: '10mb' }));

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  return apiKey && apiKey !== 'MY_GEMINI_API_KEY' ? new GoogleGenAI({ apiKey }) : null;
}

function validateObjective(value: unknown, field = 'objective'): string | null {
  if (typeof value !== 'string' || value.trim().length < 3) return `${field} must be at least 3 characters`;
  if (value.trim().length > 5000) return `${field} must be at most 5000 characters`;
  return null;
}

async function callFastApiPlanner(objective: string, context: string, horizonDays: number) {
  const controller = new AbortController();
  const timeoutMs = Number(process.env.FASTAPI_TIMEOUT_MS || 35000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${fastApiUrl}/api/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ objective, context, horizon_days: horizonDays }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        connected: false,
        error: data?.detail || `FastAPI returned HTTP ${response.status}`,
        model: null,
      };
    }
    return {
      connected: true,
      result: data?.result || null,
      model: data?.model || process.env.GEMINI_MODEL || 'Gemini',
      provider: data?.provider || (data?.model ? 'gemini' : null),
      retries: data?.retries || 0,
    };
  } catch (error: any) {
    return {
      connected: false,
      error: error?.name === 'AbortError'
        ? `FastAPI planner timed out after ${Math.round(timeoutMs / 1000)} seconds`
        : error?.message || String(error),
      model: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

app.get('/api/health', async (_req, res) => {
  let fastApiConnected = false;
  let fastApiStatusCode: number | undefined;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(`${fastApiUrl}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    fastApiStatusCode = response.status;
    fastApiConnected = response.ok;
  } catch {
    fastApiConnected = false;
  }
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    geminiConfigured: Boolean(getGeminiClient()),
    fastApiConnected,
    fastApiStatusCode,
    fastApiUrl,
    engine: 'IntelliTask Multi-Agent Express Server',
    llm: new LLMProviderManager(getGeminiClient() || undefined).getStatus(),
  });
});

app.post('/api/tools/web-search', async (req, res) => {
  const error = validateObjective(req.body?.query, 'query');
  if (error) return res.status(400).json({ error });
  const limit = Math.max(1, Math.min(Number(req.body.limit) || 5, 10));
  try {
    const results = await executeDuckDuckGoSearch(String(req.body.query).trim(), limit);
    return res.json(results);
  } catch (error: any) {
    return res.status(502).json({
      error: error?.message || 'DuckDuckGo web search failed.',
      code: 'WEB_SEARCH_ERROR',
      query: String(req.body.query || '').trim(),
    });
  }
});

app.post('/api/tools/calculate-schedule', (req, res) => {
  try {
    return res.json(executeCalculateSchedule(req.body || {}));
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || 'Invalid schedule parameters' });
  }
});

app.post('/api/agents/orchestrate', async (req, res) => {
  const { userGoal, userId, memoryContext, horizonDays } = req.body || {};
  const inputError = validateObjective(userGoal, 'userGoal');
  if (inputError) return res.status(400).json({ error: inputError, code: 'INVALID_INPUT' });
  const ai = getGeminiClient() ?? undefined;
  const providerStatus = new LLMProviderManager(ai ?? undefined).getStatus();
  if (!providerStatus.geminiConfigured && !providerStatus.groqConfigured) {
    return res.status(503).json({
      error: 'No LLM provider credentials are configured on the server.',
      code: 'MISSING_PROVIDER_CREDENTIALS',
      message: 'Configure GEMINI_API_KEY or GROQ_API_KEY and the corresponding model environment variable.',
    });
  }
  try {
    const result = await runMultiAgentOrchestration(ai, {
      userGoal: userGoal.trim(),
      userId: typeof userId === 'string' && userId ? userId : 'anonymous',
      memoryContext: Array.isArray(memoryContext) ? memoryContext : [],
      horizonDays: typeof horizonDays === 'number' ? horizonDays : 14,
    });
    return res.json(result);
  } catch (error: any) {
    return res.status(502).json({
      error: error?.message || 'Multi-agent orchestration failed.',
      code: 'ORCHESTRATION_ERROR',
    });
  }
});

app.post('/api/assistant/chat', async (req, res) => {
  const ai = getGeminiClient() ?? undefined;
  const providerStatus = new LLMProviderManager(ai ?? undefined).getStatus();
  if (!providerStatus.geminiConfigured && !providerStatus.groqConfigured) {
    return res.status(503).json({ error: 'No LLM provider credentials are configured.', code: 'MISSING_PROVIDER_CREDENTIALS' });
  }
  const { messages, systemRole, contextData } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 50) {
    return res.status(400).json({ error: 'messages must contain between 1 and 50 entries.' });
  }
  try {
    const systemPrompt = `You are the IntelliTask AI Executive Copilot.
Role: ${systemRole || 'Task planning assistant'}
Context: ${JSON.stringify(contextData || {})}`;
    const contents = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      ...messages.map((message: any) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(message.content || '') }],
      })),
    ];
    const response = await generateContentWithFallback(ai, { contents: contents as any });
    return res.json({
      reply: response.text || 'No response generated.',
      timestamp: new Date().toISOString(),
      provider: response.provider,
      model: response.model,
      providerMetadata: response.providerMetadata,
    });
  } catch (error: any) {
    return res.status(502).json({ error: error?.message || 'Gemini assistant request failed.', code: 'GEMINI_ERROR' });
  }
});

function normalizePlannerPlan(raw: unknown, objective: string, horizonDays: number): any {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Planner provider returned no JSON plan object.');
  }
  const plan = raw as Record<string, any>;
  if (typeof plan.title !== 'string' || !plan.title.trim()) {
    throw new Error('Planner provider returned an invalid plan: missing title.');
  }
  if (typeof plan.summary !== 'string' || !plan.summary.trim()) {
    throw new Error('Planner provider returned an invalid plan: missing summary.');
  }
  if (!Array.isArray(plan.milestones)) {
    throw new Error('Planner provider returned an invalid plan: missing milestones array.');
  }

  const flattenedTasks: any[] = [];
  for (const milestone of plan.milestones) {
    if (Array.isArray(milestone?.tasks)) {
      flattenedTasks.push(...milestone.tasks);
    }
  }

  const uniqueTasks: any[] = [];
  const seenTitles = new Set<string>();
  for (const task of flattenedTasks) {
    const title = typeof task?.title === 'string' ? task.title.trim() : '';
    const description = typeof task?.description === 'string' ? task.description.trim() : '';
    if (!title || !description) {
      throw new Error('Planner provider returned an incomplete daily task: missing title or description.');
    }
    if (!Number.isFinite(Number(task?.estimatedHours)) || Number(task?.estimatedHours) <= 0) {
      throw new Error('Planner provider returned an incomplete daily task: missing estimated hours.');
    }
    if (!['low', 'medium', 'high', 'urgent'].includes(task?.priority)) {
      throw new Error('Planner provider returned an incomplete daily task: missing priority.');
    }
    const key = title.toLowerCase();
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      uniqueTasks.push(task);
    }
  }

  if (uniqueTasks.length !== horizonDays) {
    throw new Error(
      `Planner provider returned ${uniqueTasks.length} unique tasks for a ${horizonDays}-day horizon; exactly ${horizonDays} daily tasks are required.`,
    );
  }

  return {
    title: plan.title.trim(),
    summary: plan.summary.trim(),
    estimatedDays: horizonDays,
    riskLevel: plan.riskLevel === 'High' || plan.riskLevel === 'Low' ? plan.riskLevel : 'Medium',
    milestones: uniqueTasks.map((task: any, dayIndex: number) => ({
      id: `DAY-${dayIndex + 1}`,
      title: `Day ${dayIndex + 1}: ${task.title.trim()}`,
      description: task.description.trim(),
      dayOffset: dayIndex + 1,
      tasks: [{
        title: typeof task?.title === 'string' ? task.title : '',
        description: typeof task?.description === 'string' ? task.description : '',
        priority: ['low', 'medium', 'high', 'urgent'].includes(task?.priority) ? task.priority : 'medium',
        estimatedHours: Number.isFinite(Number(task?.estimatedHours)) ? Number(task.estimatedHours) : 4,
        recommendedAgent: typeof task?.recommendedAgent === 'string' ? task.recommendedAgent : 'Unassigned',
        dependencies: Array.isArray(task?.dependencies)
          ? task.dependencies.filter((dependency: unknown) => typeof dependency === 'string')
          : [],
      }],
    })),
    langGraphExecutionNodes: Array.isArray(plan.langGraphExecutionNodes)
      ? plan.langGraphExecutionNodes.filter((node: any) => node && typeof node === 'object' && typeof node.nodeName === 'string')
      : [],
    criticalRisks: Array.isArray(plan.criticalRisks)
      ? plan.criticalRisks.filter((risk: unknown) => typeof risk === 'string')
      : [],
  };
}


app.post('/api/planner/generate', async (req, res) => {
  const { objective, techStack, constraints, teamSize, horizonDays } = req.body || {};
  const inputError = validateObjective(objective);
  if (inputError) return res.status(400).json({ error: inputError, code: 'INVALID_INPUT' });
  const horizon = Math.max(1, Math.min(Number(horizonDays) || 14, 90));
  const fastApi = await callFastApiPlanner(
    String(objective).trim(),
    `Tech stack: ${techStack || 'Not specified'}\nConstraints: ${constraints || 'None'}\nTeam: ${teamSize || 'Individual'}`,
    horizon,
  );

  let plan: any = null;
  let activeProvider: string | null = fastApi.connected ? fastApi.provider || null : null;
  let activeModel: string | null = fastApi.connected ? fastApi.model || null : null;
  let source = fastApi.connected && fastApi.model
    ? `FastAPI Python ${String(fastApi.provider || 'LLM').replace(/^./, (value) => value.toUpperCase())} Agent (${fastApi.model})`
    : 'Configured LLM provider';
  let warnings: string[] = [];

  if (
    fastApi.connected &&
    fastApi.result &&
    Array.isArray(fastApi.result.tasks) &&
    fastApi.result.tasks.length === horizon &&
    new Set(fastApi.result.tasks.map((task: any) => String(task?.title || '').trim().toLowerCase()).filter(Boolean)).size === horizon &&
    fastApi.result.tasks.every((task: any) => String(task?.title || '').trim() && String(task?.description || '').trim())
  ) {
    const pythonTasks = Array.isArray(fastApi.result.tasks) ? fastApi.result.tasks : [];
    const uniquePythonTaskTitles = new Set(
      pythonTasks.map((task: any) => String(task?.title || '').trim().toLowerCase()).filter(Boolean),
    );
    if (pythonTasks.length === horizon && uniquePythonTaskTitles.size === horizon) {
      plan = {
        title: String(objective).trim(),
        summary: fastApi.result.summary || 'Structured plan returned by the Python Gemini planning agent.',
        estimatedDays: horizon,
        riskLevel: Array.isArray(fastApi.result.risks) && fastApi.result.risks.length > 2 ? 'High' : 'Medium',
        milestones: pythonTasks.map((task: any, dayIndex: number) => ({
          id: `DAY-${dayIndex + 1}`,
          title: `Day ${dayIndex + 1}: ${task.title || `Daily task ${dayIndex + 1}`}`,
          description: task.description || '',
          dayOffset: dayIndex + 1,
          tasks: [{
            title: task.title || `Daily task ${dayIndex + 1}`,
            description: task.description || '',
            priority: ['low', 'medium', 'high', 'urgent'].includes(task.priority) ? task.priority : 'medium',
            estimatedHours: Number(task.estimatedHours) || 4,
            recommendedAgent: `Python ${String(fastApi.provider || 'LLM').replace(/^./, (value) => value.toUpperCase())} Planning Agent`,
            dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
          }],
        })),
        criticalRisks: Array.isArray(fastApi.result.risks) ? fastApi.result.risks : [],
        langGraphExecutionNodes: [],
      };
    } else {
      warnings.push(`Python planning service returned ${uniquePythonTaskTitles.size} unique daily tasks for a ${horizon}-day horizon; retrying with the Express provider path.`);
    }
  } else {
    warnings.push(
      fastApi.error
        ? fastApi.error
        : fastApi.connected
          ? `FastAPI planning output did not contain exactly ${horizon} unique daily tasks.`
          : 'FastAPI planning service was unavailable.',
    );
    const ai = getGeminiClient() ?? undefined;
    const providerStatus = new LLMProviderManager(ai ?? undefined).getStatus();
    if (!providerStatus.geminiConfigured && !providerStatus.groqConfigured) {
      return res.status(503).json({
        error: 'No configured LLM planner is available.',
        code: 'PLANNER_UNAVAILABLE',
        message: 'Configure GEMINI_API_KEY/GEMINI_MODEL or GROQ_API_KEY/GROQ_MODEL, or start the Python FastAPI service.',
        fastApi,
      });
    }
    const batchRanges = horizon === 7
      ? [[1, 3], [4, 5], [6, 7]]
      : Array.from({ length: Math.ceil(horizon / 3) }, (_, index) => [
          index * 3 + 1,
          Math.min((index + 1) * 3, horizon),
        ]);
    try {
      let response: Awaited<ReturnType<typeof generateContentWithFallback>> | null = null;
      const mergedTasks: any[] = [];
      const executionLogs: any[] = [];
      const seenDays = new Set<number>();
      for (const [startDay, endDay] of batchRanges) {
        const batchPrompt = `Return only valid JSON for Days ${startDay}-${endDay}.
Objective: ${objective}
Horizon: ${horizon} days
Generate exactly ${endDay - startDay + 1} unique tasks, one per day.
{"tasks":[{"title":string,"description":string,"priority":"low"|"medium"|"high"|"urgent","estimatedHours":number,"dayOffset":number,"dependencies":string[]}]}`;
        try {
          response = await generateContentWithFallback(ai, {
            contents: batchPrompt,
            config: { responseMimeType: 'application/json' },
          });
          const parsed = JSON.parse((response.text || '{}').replace(/```json|```/g, '').trim());
          const tasks = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
          for (const task of tasks) {
            const day = Number(task?.dayOffset);
            const title = String(task?.title || '').trim();
            const description = String(task?.description || '').trim();
            const priority = String(task?.priority || '').toLowerCase();
            const hours = Number(task?.estimatedHours);
            if (!Number.isInteger(day) || day < startDay || day > endDay || !title || !description ||
                !['low', 'medium', 'high', 'urgent'].includes(priority) || !Number.isFinite(hours) || hours <= 0) {
              throw new Error(`Incomplete task data returned for Days ${startDay}-${endDay}.`);
            }
            if (seenDays.has(day)) throw new Error(`Duplicate day number Day ${day} returned.`);
            seenDays.add(day);
            mergedTasks.push({ ...task, title, description, priority, estimatedHours: hours });
          }
          executionLogs.push({ batch: `Days ${startDay}-${endDay}`, provider: response.provider, model: response.model, status: 'success' });
        } catch (error: any) {
          if (activeProvider === 'groq' || new LLMProviderManager(ai ?? undefined).getStatus().groqConfigured) {
            try {
              const repairResponse = await generateContentWithFallback(ai, {
                contents: `${batchPrompt}\nRepair required: ${error?.message || 'invalid batch output'}\nReturn exactly ${endDay - startDay + 1} tasks with dayOffset integers only from ${startDay} through ${endDay}.`,
                config: { responseMimeType: 'application/json', temperature: 0.1 },
              });
              const repaired = JSON.parse((repairResponse.text || '{}').replace(/```json|```/g, '').trim());
              const repairedTasks = Array.isArray(repaired?.tasks) ? repaired.tasks : [];
              const repairedSeen = new Set<number>();
              for (const task of repairedTasks) {
                const day = Number(task?.dayOffset);
                if (!Number.isInteger(day) || day < startDay || day > endDay || repairedSeen.has(day)) {
                  throw new Error(`Repair returned invalid or duplicate Day ${day}.`);
                }
                const title = String(task?.title || '').trim();
                const description = String(task?.description || '').trim();
                const priority = String(task?.priority || '').toLowerCase();
                const hours = Number(task?.estimatedHours);
                if (!title || !description || !['low', 'medium', 'high', 'urgent'].includes(priority) || !Number.isFinite(hours) || hours <= 0) {
                  throw new Error(`Repair returned incomplete task data for Day ${day}.`);
                }
                repairedSeen.add(day);
                mergedTasks.push({ ...task, title, description, priority, estimatedHours: hours });
                seenDays.add(day);
              }
              const expectedRepairDays = endDay - startDay + 1;
              if (repairedSeen.size !== expectedRepairDays) {
                throw new Error(`Repair returned ${repairedSeen.size} tasks instead of ${expectedRepairDays}.`);
              }
              response = repairResponse;
              executionLogs.push({ batch: `Days ${startDay}-${endDay}`, provider: repairResponse.provider, model: repairResponse.model, status: 'success', repair: true });
              continue;
            } catch {
              // Fall through to the honest batch failure below.
            }
          }
          throw new Error(`Batch Days ${startDay}-${endDay} failed: ${error?.message || String(error)} Missing Days ${startDay}-${endDay}.`);
        }
      }
      const missingDays = Array.from({ length: horizon }, (_, index) => index + 1).filter((day) => !seenDays.has(day));
      if (missingDays.length || mergedTasks.length !== horizon) {
        throw new Error(`Incomplete 7-day generation. Missing Days ${missingDays.join(', ') || 'unknown'}.`);
      }
      const orderedTasks = mergePlannerBatches(mergedTasks, horizon);
      plan = normalizePlannerPlan({
        title: String(objective).trim(),
        summary: `A ${horizon}-day actionable roadmap with one unique task per day.`,
        estimatedDays: horizon,
        riskLevel: 'Medium',
        milestones: orderedTasks.map((task: any) => ({
          id: `DAY-${task.dayOffset}`,
          title: `Day ${task.dayOffset}: ${task.title}`,
          description: task.description,
          dayOffset: task.dayOffset,
          tasks: [{
            title: task.title,
            description: task.description,
            priority: task.priority,
            estimatedHours: task.estimatedHours,
            recommendedAgent: 'Planner Agent',
            dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
          }],
        })),
        criticalRisks: [],
        langGraphExecutionNodes: [],
      }, String(objective).trim(), horizon);
      source = `${response?.provider === 'groq' ? 'Groq' : 'Gemini'} (${response?.model})`;
      activeProvider = response?.provider || null;
      activeModel = response?.model || null;
    } catch (error: any) {
      return res.status(502).json({
        error: error?.message || 'Plan generation failed.',
        code: 'PLANNER_ERROR',
        fastApi,
        failedAgent: 'Express Planner Agent / Gemini',
        message: `Planner Agent failed: ${error?.message || 'Gemini plan generation failed after retries.'}${fastApi.error ? ` Python agent also unavailable: ${fastApi.error}` : ''}`,
      });
    }
  }
  try {
    plan = normalizePlannerPlan(plan, String(objective).trim(), horizon);
  } catch (error: any) {
    return res.status(502).json({
      error: error?.message || 'The planner returned an invalid plan structure.',
      code: 'INVALID_PLANNER_RESPONSE',
      fastApi,
      failedAgent: activeProvider === 'groq' ? 'Groq Planner Agent' : 'Planner Agent',
    });
  }
  return res.json({
    plan,
    summary: plan.summary,
    horizonDays: horizon,
    milestones: plan.milestones,
    tasks: plan.milestones.flatMap((milestone: any) =>
      (milestone.tasks || []).map((task: any) => ({
        ...task,
        dayOffset: milestone.dayOffset,
      })),
    ),
    executionLogs: [
      {
        agent: activeProvider === 'groq' ? 'Groq Planner Agent' : activeProvider === 'gemini' ? 'Gemini Planner Agent' : 'Planner Agent',
        provider: activeProvider,
        model: activeModel,
        status: 'success',
      },
    ],
    generatedAt: new Date().toISOString(),
    source,
    provider: activeProvider,
    model: activeModel,
    warnings,
    fastApi: fastApi.connected ? { connected: true, model: fastApi.model, retries: fastApi.retries || 0 } : { connected: false, error: fastApi.error },
  });
});

app.post('/api/research/query', async (req, res) => {
  const ai = getGeminiClient() ?? undefined;
  const providerStatus = new LLMProviderManager(ai ?? undefined).getStatus();
  if (!providerStatus.geminiConfigured && !providerStatus.groqConfigured) {
    return res.status(503).json({ error: 'No LLM provider credentials are configured.', code: 'MISSING_PROVIDER_CREDENTIALS' });
  }
  const { topic, depth, focusAreas } = req.body || {};
  const inputError = validateObjective(topic, 'topic');
  if (inputError) return res.status(400).json({ error: inputError, code: 'INVALID_INPUT' });
  const search = await executeDuckDuckGoSearch(topic, 5);
  const prompt = `Research only from these sources; do not invent sources.
Topic: ${topic}
Depth: ${depth || 'Comprehensive'}
Focus areas: ${Array.isArray(focusAreas) ? focusAreas.join(', ') : 'Architecture, trade-offs, implementation'}
Sources: ${JSON.stringify(search.results)}
Return only valid JSON: {"topic":string,"executiveSummary":string,"keyFindings":string[],"technicalRecommendations":[{"area":string,"recommendation":string,"rationale":string}],"implementationRoadmap":[{"phase":string,"deliverables":string[]}],"confidenceScore":number,"sources":[{"title":string,"url":string,"source":string}]}`;
  try {
    const response = await generateContentWithFallback(ai, {
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });
    const dossier = JSON.parse((response.text || '{}').replace(/```json|```/g, '').trim());
    dossier.sources = search.results.map((item) => ({ title: item.title, url: item.link, source: item.source }));
    dossier.searchErrors = search.errors;
    return res.json({ dossier, researchedAt: new Date().toISOString(), engine: `Gemini + ${search.source}` });
  } catch (error: any) {
    return res.status(502).json({ error: error?.message || 'Research synthesis failed.', code: 'RESEARCH_ERROR', search });
  }
});

app.post('/api/langgraph/check-connection', async (req, res) => {
  const target = String(req.body?.endpointUrl || fastApiUrl).trim().replace(/\/$/, '');
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const response = await fetch(`${target}/health`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await response.json().catch(() => null);
    return res.json({
      connected: response.ok,
      endpoint: target,
      latencyMs: Date.now() - start,
      statusCode: response.status,
      response: data,
      message: response.ok ? 'FastAPI health endpoint reachable.' : `HTTP ${response.status} from FastAPI.`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return res.json({
      connected: false,
      endpoint: target,
      latencyMs: Date.now() - start,
      error: error?.name === 'AbortError' ? 'Connection timed out.' : error?.message || String(error),
      recommendation: 'Start the Python service with: uvicorn main:app --reload --port 8000',
      timestamp: new Date().toISOString(),
    });
  }
});

async function startServer() {
  if (!isProduction) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => res.sendFile(path.resolve(__dirname, 'dist', 'index.html')));
  }
  app.listen(port, '0.0.0.0', () => {
    console.log(`IntelliTask AI server active on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start IntelliTask server:', error);
  process.exit(1);
});
