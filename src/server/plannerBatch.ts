export function mergePlannerBatches(batchTasks: unknown[], horizonDays: number): any[] {
  const byDay = new Map<number, any>();
  for (const task of batchTasks) {
    if (!task || typeof task !== 'object') throw new Error('Malformed batch task.');
    const record = task as Record<string, any>;
    const day = Number(record.dayOffset);
    if (!Number.isInteger(day) || day < 1 || day > horizonDays) {
      throw new Error(`Duplicate or invalid day number returned: ${String(record.dayOffset)}.`);
    }
    if (byDay.has(day)) throw new Error(`Duplicate day number Day ${day} returned.`);
    const title = String(record.title || '').trim();
    const description = String(record.description || '').trim();
    const priority = String(record.priority || '').toLowerCase();
    const hours = Number(record.estimatedHours);
    if (!title || !description || !['low', 'medium', 'high', 'urgent'].includes(priority) || !Number.isFinite(hours) || hours <= 0) {
      throw new Error(`Incomplete task data returned for Day ${day}.`);
    }
    byDay.set(day, { ...record, title, description, priority, estimatedHours: hours });
  }
  const missing = Array.from({ length: horizonDays }, (_, index) => index + 1).filter((day) => !byDay.has(day));
  if (missing.length || byDay.size !== horizonDays) {
    throw new Error(`Missing daily tasks for Day ${missing.join(', ') || 'unknown'}.`);
  }
  return Array.from(byDay.entries()).sort(([a], [b]) => a - b).map(([, task]) => task);
}
