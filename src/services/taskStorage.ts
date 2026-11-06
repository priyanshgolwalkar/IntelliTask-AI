import { collection, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Task, TaskPriority, TaskStatus } from '../types';

const STORAGE_PREFIX = 'intellitask_tasks_';

export const DEMO_TASK_IDS = ['TASK-101', 'TASK-102', 'TASK-103', 'TASK-104', 'TASK-105', 'TASK-106'] as const;

export const LEGACY_DEVELOPMENT_TASK_IDS = ['TASK-107', 'TASK-103', 'TASK-106'] as const;

export function isDemoTask(taskId: string, task?: Partial<Task>): boolean {
  if (!DEMO_TASK_IDS.includes(taskId as typeof DEMO_TASK_IDS[number])) return false;
  const title = task?.title;
  return Boolean(
    title && (
      title === 'Configure LangGraph State Graph & Node Checkpoints' ||
      title === 'Synthesize Model Benchmark: Gemini 2.5 Flash vs Local Reasoning' ||
      title === 'Implement FastAPI Pydantic v2 Models & Auth Headers' ||
      title === 'Orchestrate Automated Multi-Stage Release Verification' ||
      title === 'Draft Autonomous Decomposition Heuristics for Epics' ||
      title === 'Migrate In-Memory Task Ledger to Persistent Postgres Store'
    )
  );
}

export const INITIAL_SAMPLE_TASKS: Task[] = [
  {
    id: 'TASK-101',
    title: 'Configure LangGraph State Graph & Node Checkpoints',
    description: 'Define StateGraph schema with supervisor, research, planner, code, and review nodes. Ensure state persistence supports checkpoint rollback.',
    status: 'in_progress',
    priority: 'urgent',
    assignedAgent: 'Supervisor',
    tags: ['LangGraph', 'Architecture', 'Python'],
    createdAt: '2026-11-01T09:00:00Z',
    dueDate: '2026-11-06T18:00:00Z',
    estimatedHours: 12,
    subtasks: [
      { id: 'sub-1', title: 'Define TypedDict state interface with operator channels', completed: true },
      { id: 'sub-2', title: 'Implement supervisor routing conditional edge', completed: true },
      { id: 'sub-3', title: 'Attach Postgres or SQLite checkpointer for recovery', completed: false },
    ],
    source: 'manual',
    langGraphNodeId: 'supervisor_node',
  },
  {
    id: 'TASK-102',
    title: 'Synthesize Model Benchmark: Gemini 2.5 Flash vs Local Reasoning',
    description: 'Execute quantitative analysis comparing latency, tool-calling reliability, structured JSON compliance, and token unit costs for task planning.',
    status: 'in_review',
    priority: 'high',
    assignedAgent: 'Research Specialist',
    tags: ['Research', 'LLM', 'Benchmarks'],
    createdAt: '2026-11-02T11:30:00Z',
    dueDate: '2026-11-05T12:00:00Z',
    estimatedHours: 6,
    subtasks: [
      { id: 'sub-4', title: 'Collate TTFT (time-to-first-token) telemetry', completed: true },
      { id: 'sub-5', title: 'Evaluate schema drift under complex nested arrays', completed: true },
      { id: 'sub-6', title: 'Compile executive recommendations dossier', completed: false },
    ],
    source: 'research',
    langGraphNodeId: 'researcher_node',
  },
  {
    id: 'TASK-103',
    title: 'Implement FastAPI Pydantic v2 Models & Auth Headers',
    description: 'Write robust request/response serializers for task dispatch, agent execution states, and audit log streams with strict schema validation.',
    status: 'todo',
    priority: 'high',
    assignedAgent: 'Code Generator',
    tags: ['FastAPI', 'Backend', 'Security'],
    createdAt: '2026-11-03T08:15:00Z',
    dueDate: '2026-11-08T17:00:00Z',
    estimatedHours: 8,
    subtasks: [
      { id: 'sub-7', title: 'Create TaskCreate and TaskUpdate Pydantic models', completed: false },
      { id: 'sub-8', title: 'Add API key dependency with Bearer token fallback', completed: false },
      { id: 'sub-9', title: 'Write unit tests with HTTPX test client', completed: false },
    ],
    source: 'manual',
    langGraphNodeId: 'coder_node',
  },
  {
    id: 'TASK-104',
    title: 'Orchestrate Automated Multi-Stage Release Verification',
    description: 'Run integration test matrix checking schema compatibility, task state mutations, and edge case recovery across asynchronous workers.',
    status: 'todo',
    priority: 'medium',
    assignedAgent: 'QA Reviewer',
    tags: ['Testing', 'QA', 'CI/CD'],
    createdAt: '2026-11-03T10:00:00Z',
    dueDate: '2026-11-10T15:00:00Z',
    estimatedHours: 10,
    subtasks: [
      { id: 'sub-10', title: 'Write regression fixtures for graph cycles', completed: false },
      { id: 'sub-11', title: 'Verify idempotency on duplicate task submission', completed: false },
    ],
    source: 'ai_planner',
    langGraphNodeId: 'reviewer_node',
  },
  {
    id: 'TASK-105',
    title: 'Draft Autonomous Decomposition Heuristics for Epics',
    description: 'Develop structured prompt specifications and LangGraph planner nodes capable of breaking ambiguous epics into 3-5 day milestones.',
    status: 'completed',
    priority: 'medium',
    assignedAgent: 'Planner Architect',
    tags: ['Planning', 'PromptEngineering'],
    createdAt: '2026-10-28T14:00:00Z',
    dueDate: '2026-11-01T17:00:00Z',
    estimatedHours: 14,
    subtasks: [
      { id: 'sub-12', title: 'Define milestone schema and dependencyDAG structure', completed: true },
      { id: 'sub-13', title: 'Validate zero-hallucination constraint validation', completed: true },
      { id: 'sub-14', title: 'Deploy schema to planner endpoint', completed: true },
    ],
    source: 'ai_planner',
    langGraphNodeId: 'planner_node',
  },
  {
    id: 'TASK-106',
    title: 'Migrate In-Memory Task Ledger to Persistent Postgres Store',
    description: 'Prepare SQLAlchemy 2.0 / asyncpg database migration scripts for production task ledger persistence with row-level locking.',
    status: 'blocked',
    priority: 'high',
    assignedAgent: 'Code Generator',
    tags: ['Database', 'Postgres', 'Migration'],
    createdAt: '2026-11-02T16:00:00Z',
    dueDate: '2026-11-07T12:00:00Z',
    estimatedHours: 9,
    subtasks: [
      { id: 'sub-15', title: 'Generate Alembic migration script', completed: true },
      { id: 'sub-16', title: 'Awaiting production database credentials approval', completed: false },
    ],
    source: 'manual',
    langGraphNodeId: 'coder_node',
  },
];

class TaskStorageService {
  private currentUserId: string | null = null;
  private tasks: Task[] = [];
  private isInitialized = false;
  private lastLegacyCleanup: string[] = [];

  constructor() {
    this.tasks = this.loadLocal('guest');
  }

  private getStorageKey(userId?: string): string {
    return `${STORAGE_PREFIX}${userId || this.currentUserId || 'guest'}`;
  }

  private loadLocal(userId: string): Task[] {
    try {
      const stored = localStorage.getItem(this.getStorageKey(userId));
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    // Guests start empty; sample tasks are never presented as saved work.
    return [];
  }

  private saveLocal(tasks: Task[]): void {
    this.tasks = tasks;
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(tasks));
    } catch {
      // Ignore quota
    }
  }

  /**
   * Set active user and load their isolated tasks from Firestore with local fallback
   */
  public async setUserId(userId: string | null): Promise<Task[]> {
    this.currentUserId = userId;
    if (!userId) {
      this.tasks = this.loadLocal('guest');
      this.tasks = this.tasks.filter((task) => !LEGACY_DEVELOPMENT_TASK_IDS.includes(task.id as typeof LEGACY_DEVELOPMENT_TASK_IDS[number]));
      this.saveLocal([]);
      return this.tasks;
    }

    // Load cached local tasks first for instant UI response
    const cached = this.loadLocal(userId).filter(
      (task) =>
        !isDemoTask(task.id, task) &&
        !LEGACY_DEVELOPMENT_TASK_IDS.includes(task.id as typeof LEGACY_DEVELOPMENT_TASK_IDS[number])
    );
    this.tasks = Array.from(new Map(cached.map((task) => [task.id, task])).values());
    this.saveLocal(this.tasks);

    // Sync from user's isolated Firestore subcollection
    const path = `users/${userId}/tasks`;
    try {
      const colRef = collection(db, 'users', userId, 'tasks');
      const snapshot = await getDocs(colRef);

      if (!snapshot.empty) {
        const remoteTasks: Task[] = [];
        const removedLegacyIds: string[] = [];
        const legacyDeletionPromises: Promise<void>[] = [];
        snapshot.forEach((docSnap) => {
          const task = docSnap.data() as Task;
          if (LEGACY_DEVELOPMENT_TASK_IDS.includes(docSnap.id as typeof LEGACY_DEVELOPMENT_TASK_IDS[number])) {
            removedLegacyIds.push(docSnap.id);
            legacyDeletionPromises.push(deleteDoc(docSnap.ref).catch((error) =>
              console.warn(`Failed to remove legacy task ${docSnap.id}:`, error)
            ));
            return;
          }
          if (isDemoTask(docSnap.id, task)) {
            deleteDoc(docSnap.ref).catch((error) =>
              console.warn(`Failed to remove demo task ${docSnap.id}:`, error)
            );
            return;
          }
          remoteTasks.push(task.id ? task : { ...task, id: docSnap.id });
        });
        await Promise.all(legacyDeletionPromises);
        this.lastLegacyCleanup = removedLegacyIds;
        const deduplicated = Array.from(new Map(remoteTasks.map((task) => [task.id, task])).values());
        deduplicated.sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        this.saveLocal(deduplicated);
        this.isInitialized = true;
        return this.tasks;
      } else {
        // User starts with a clean isolated task collection
        this.lastLegacyCleanup = [];
        this.saveLocal([]);
        this.isInitialized = true;
        return this.tasks;
      }
    } catch (error) {
      console.warn('Firestore task sync fallback to local cache:', error);
      // Return cached tasks gracefully
      return this.tasks;
    }
  }

  public getAll(): Task[] {
    return [...this.tasks];
  }

  public getLastLegacyCleanup(): string[] {
    return [...this.lastLegacyCleanup];
  }

  public getById(id: string): Task | undefined {
    return this.tasks.find((t) => t.id === id);
  }

  public async create(taskData: Omit<Task, 'id' | 'createdAt'>): Promise<Task> {
    const usedNumbers = this.tasks
      .map((task) => Number(task.id.match(/^TASK-(\d+)$/)?.[1]))
      .filter((number) => Number.isFinite(number));
    const nextNumber = Math.max(100, ...usedNumbers) + 1;
    const newTask: Task = {
      ...taskData,
      id: `TASK-${nextNumber}`,
      createdAt: new Date().toISOString(),
    };
    const updated = [newTask, ...this.tasks];
    this.saveLocal(updated);

    if (this.currentUserId) {
      const path = `users/${this.currentUserId}/tasks/${newTask.id}`;
      try {
        const docRef = doc(db, 'users', this.currentUserId, 'tasks', newTask.id);
        await setDoc(docRef, { ...newTask, userId: this.currentUserId });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, path);
      }
    }

    return newTask;
  }

  public async update(id: string, updates: Partial<Task>): Promise<Task | null> {
    const index = this.tasks.findIndex((t) => t.id === id);
    if (index === -1) return null;

    const updatedTask = { ...this.tasks[index], ...updates };
    this.tasks[index] = updatedTask;
    this.saveLocal([...this.tasks]);

    if (this.currentUserId) {
      const path = `users/${this.currentUserId}/tasks/${id}`;
      try {
        const docRef = doc(db, 'users', this.currentUserId, 'tasks', id);
        await setDoc(docRef, { ...updatedTask, userId: this.currentUserId }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    }

    return updatedTask;
  }

  public async updateStatus(id: string, status: TaskStatus): Promise<Task | null> {
    return this.update(id, { status });
  }

  public async toggleSubtask(taskId: string, subtaskId: string): Promise<Task | null> {
    const task = this.getById(taskId);
    if (!task) return null;

    const subtasks = task.subtasks.map((st) =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );

    return this.update(taskId, { subtasks });
  }

  public async delete(id: string): Promise<boolean> {
    const initialLength = this.tasks.length;
    this.tasks = this.tasks.filter((t) => t.id !== id);
    if (this.tasks.length !== initialLength) {
      this.saveLocal([...this.tasks]);

      if (this.currentUserId) {
        const path = `users/${this.currentUserId}/tasks/${id}`;
        try {
          const docRef = doc(db, 'users', this.currentUserId, 'tasks', id);
          await deleteDoc(docRef);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, path);
        }
      }
      return true;
    }
    return false;
  }

  public async resetToSample(): Promise<Task[]> {
    this.tasks = [];
    this.saveLocal(this.tasks);
    return this.tasks;
  }

  public exportJSON(): string {
    return JSON.stringify(this.tasks, null, 2);
  }

  public importJSON(jsonStr: string): boolean {
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((task) => !isDemoTask(task.id, task));
        this.saveLocal(Array.from(new Map(cleaned.map((task) => [task.id, task])).values()));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}

export const taskStorage = new TaskStorageService();
