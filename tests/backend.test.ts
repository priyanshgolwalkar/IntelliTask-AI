import test from 'node:test';
import assert from 'node:assert/strict';
import {
  executeCalculateSchedule,
  executeDuckDuckGoSearch,
  isTemporaryGeminiError,
} from '../src/server/multiAgentOrchestrator.ts';
import { classifyProviderError } from '../src/server/llmProviderManager.ts';
import { normalizeGeneratedPlan } from '../src/services/geminiService.ts';
import { mergePlannerBatches } from '../src/server/plannerBatch.ts';

test('schedule calculator generates a valid deadline plan', () => {
  const schedule = executeCalculateSchedule({
    startDate: '2026-11-05',
    horizonDays: 7,
    milestoneCount: 3,
  });
  assert.equal(schedule.horizonDays, 7);
  assert.equal(schedule.calculatedMilestones.length, 3);
  assert.equal(schedule.startDate, '2026-11-05');
  assert.ok(schedule.calculatedMilestones.every((milestone) => milestone.targetDate));
});

test('schedule calculator rejects invalid dates', () => {
  assert.throws(() => executeCalculateSchedule({ startDate: 'not-a-date' }), /Invalid startDate/);
});

test('web search returns a truthful provider and result shape', async () => {
  const search = await executeDuckDuckGoSearch('DuckDuckGo Wikipedia test', 3);
  assert.equal(typeof search.query, 'string');
  assert.ok(Array.isArray(search.results));
  assert.ok(Array.isArray(search.errors));
  assert.ok(['duckduckgo', 'wikipedia', 'duckduckgo+wikipedia', 'none'].includes(search.source));
  for (const result of search.results) {
    assert.ok(result.title);
    assert.ok(result.link.startsWith('http'));
    assert.ok(result.source === 'duckduckgo' || result.source === 'wikipedia');
  }
});

test('Gemini retry classifier recognizes 503 and 429 failures', () => {
  assert.equal(isTemporaryGeminiError(new Error('503 UNAVAILABLE: high demand')), true);
  assert.equal(isTemporaryGeminiError(new Error('429 RESOURCE_EXHAUSTED')), true);
  assert.equal(isTemporaryGeminiError(new Error('500 server error')), true);
  assert.equal(isTemporaryGeminiError(new Error('network ECONNRESET')), true);
  assert.equal(isTemporaryGeminiError(new Error('404 model not found')), false);
});

test('provider classifier permits fallback on 404, 429, and 503 but not 401/403', () => {
  const error404 = Object.assign(new Error('model not found'), { statusCode: 404 });
  const error429 = Object.assign(new Error('quota exceeded'), { statusCode: 429 });
  const error503 = Object.assign(new Error('service unavailable'), { statusCode: 503 });
  const error401 = Object.assign(new Error('invalid API key'), { statusCode: 401 });
  assert.equal(classifyProviderError(error404).retryable, true);
  assert.equal(classifyProviderError(error429).retryable, true);
  assert.equal(classifyProviderError(error503).retryable, true);
  assert.equal(classifyProviderError(error401).retryable, false);
  assert.equal(classifyProviderError(error401).reason.includes('invalid API key'), true);
});

test('Planner normalizer accepts Groq-style plan and supplies optional arrays', () => {
  const plan = normalizeGeneratedPlan({
    title: 'Groq plan',
    summary: 'A valid Groq-generated summary.',
    estimatedDays: 3,
    riskLevel: 'Medium',
    milestones: [{
      id: 'M1',
      title: 'Study phase',
      description: 'Learn the foundations.',
      dayOffset: 1,
      tasks: [{
        title: 'Read chapter',
        description: 'Complete the assigned chapter.',
        priority: 'high',
        estimatedHours: 2,
        recommendedAgent: 'Planner Agent',
        dependencies: [],
      }],
    }],
  });
  assert.equal(plan.title, 'Groq plan');
  assert.equal(plan.milestones.length, 1);
  assert.equal(plan.milestones[0].tasks.length, 1);
  assert.deepEqual(plan.langGraphExecutionNodes, []);
  assert.deepEqual(plan.criticalRisks, []);
});

test('Planner normalizer rejects malformed plans without milestones', () => {
  assert.throws(
    () => normalizeGeneratedPlan({ title: 'Incomplete', summary: 'Missing milestones' }),
    /missing the milestones array/,
  );
  assert.throws(
    () => normalizeGeneratedPlan(null),
    /missing the required plan object/,
  );
});

test('Planner normalizer returns exactly 7 unique daily tasks for a 7-day horizon', () => {
  const milestones = Array.from({ length: 7 }, (_, index) => ({
    id: `M${index + 1}`,
    title: `Phase ${index + 1}`,
    description: `Complete day ${index + 1}`,
    dayOffset: index + 1,
    tasks: [{
      title: `Day ${index + 1} task`,
      description: `Action for day ${index + 1}`,
      priority: 'medium',
      estimatedHours: 2,
      recommendedAgent: 'Planner Agent',
      dependencies: [],
    }],
  }));
  const plan = normalizeGeneratedPlan({
    title: 'Seven day plan',
    summary: 'A seven-day roadmap.',
    estimatedDays: 7,
    riskLevel: 'Medium',
    milestones,
  }, 7);
  assert.equal(plan.estimatedDays, 7);
  assert.equal(plan.milestones.length, 7);
  assert.deepEqual(plan.milestones.map((milestone) => milestone.tasks.length), [1, 1, 1, 1, 1, 1, 1]);
  assert.equal(new Set(plan.milestones.map((milestone) => milestone.tasks[0].title)).size, 7);
});

test('Planner normalizer returns exactly 14 unique daily tasks for a 14-day horizon', () => {
  const milestones = Array.from({ length: 14 }, (_, index) => ({
    id: `M${index + 1}`,
    title: `Phase ${index + 1}`,
    description: `Complete day ${index + 1}`,
    dayOffset: index + 1,
    tasks: [{
      title: `Day ${index + 1} task`,
      description: `Action for day ${index + 1}`,
      priority: 'medium',
      estimatedHours: 1.5,
      recommendedAgent: 'Planner Agent',
      dependencies: [],
    }],
  }));
  const plan = normalizeGeneratedPlan({
    title: 'Fourteen day plan',
    summary: 'A fourteen-day roadmap.',
    estimatedDays: 14,
    riskLevel: 'Medium',
    milestones,
  }, 14);
  assert.equal(plan.estimatedDays, 14);
  assert.equal(plan.milestones.length, 14);
  assert.equal(plan.milestones.every((milestone) => milestone.tasks.length === 1), true);
});

test('Planner normalizer rejects incomplete daily task output', () => {
  const milestones = Array.from({ length: 6 }, (_, index) => ({
    id: `M${index + 1}`,
    title: `Phase ${index + 1}`,
    description: `Complete day ${index + 1}`,
    dayOffset: index + 1,
    tasks: [{
      title: `Day ${index + 1} task`,
      description: `Action for day ${index + 1}`,
      priority: 'medium',
      estimatedHours: 2,
      recommendedAgent: 'Planner Agent',
      dependencies: [],
    }],
  }));
  assert.throws(
    () => normalizeGeneratedPlan({
      title: 'Incomplete seven day plan',
      summary: 'Only six tasks.',
      estimatedDays: 7,
      riskLevel: 'Medium',
      milestones,
    }, 7),
    /exactly 7 daily tasks are required/,
  );
});

test('seven-day batch merge returns exactly seven unique days', () => {
  const batches = Array.from({ length: 7 }, (_, index) => ({
    dayOffset: index + 1,
    title: `Day ${index + 1}`,
    description: `Action ${index + 1}`,
    priority: 'medium',
    estimatedHours: 2,
  }));
  const merged = mergePlannerBatches(batches, 7);
  assert.equal(merged.length, 7);
  assert.equal(new Set(merged.map((task) => task.dayOffset)).size, 7);
});

test('missing batch reports the missing days', () => {
  const batches = Array.from({ length: 6 }, (_, index) => ({
    dayOffset: index + 1,
    title: `Day ${index + 1}`,
    description: `Action ${index + 1}`,
    priority: 'medium',
    estimatedHours: 2,
  }));
  assert.throws(() => mergePlannerBatches(batches, 7), /Missing daily tasks for Day 7/);
});

test('duplicate batch day is rejected', () => {
  const batches = [1, 1, 2, 3, 4, 5, 6, 7].map((dayOffset) => ({
    dayOffset,
    title: `Day ${dayOffset}`,
    description: `Action ${dayOffset}`,
    priority: 'medium',
    estimatedHours: 2,
  }));
  assert.throws(() => mergePlannerBatches(batches, 7), /Duplicate day number Day 1/);
});
