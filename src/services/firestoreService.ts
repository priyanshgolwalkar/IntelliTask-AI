import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Task, TaskStatus } from '../types';

export interface ChatRecord {
  id: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AgentLogRecord {
  id: string;
  userId: string;
  agentId: string;
  agentName: string;
  action: string;
  decision?: string;
  status: string;
  timestamp: string;
  toolName?: string;
  toolInput?: any;
  toolOutput?: any;
}

export interface AgentMemoryRecord {
  id: string;
  userId: string;
  agentId: string;
  category: string;
  content: string;
  updatedAt: string;
}

export class FirestoreDataService {
  // ---------------------------------------------------------------------------
  // 1. Tasks Management (/users/{userId}/tasks/{taskId})
  // ---------------------------------------------------------------------------
  public async getTasks(userId: string): Promise<Task[]> {
    const path = `users/${userId}/tasks`;
    try {
      const colRef = collection(db, 'users', userId, 'tasks');
      const snap = await getDocs(colRef);
      const tasks: Task[] = [];
      snap.forEach((d) => tasks.push(d.data() as Task));
      // Sort in-memory by createdAt descending
      return tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  }

  public subscribeTasks(
    userId: string,
    onData: (tasks: Task[]) => void,
    onError: (err: Error) => void
  ): () => void {
    const path = `users/${userId}/tasks`;
    const colRef = collection(db, 'users', userId, 'tasks');

    return onSnapshot(
      colRef,
      (snapshot) => {
        const tasks: Task[] = [];
        snapshot.forEach((d) => tasks.push(d.data() as Task));
        tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onData(tasks);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
        onError(error);
      }
    );
  }

  public async createTask(userId: string, task: Omit<Task, 'id' | 'createdAt' | 'userId'> & { id?: string }): Promise<Task> {
    const taskId = task.id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const path = `users/${userId}/tasks/${taskId}`;

    const newTask: Task = {
      ...task,
      id: taskId,
      userId,
      createdAt: new Date().toISOString(),
      subtasks: task.subtasks || [],
      tags: task.tags || [],
    };

    try {
      const docRef = doc(db, 'users', userId, 'tasks', taskId);
      await setDoc(docRef, newTask);
      return newTask;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  }

  public async updateTask(userId: string, taskId: string, updates: Partial<Task>): Promise<void> {
    const path = `users/${userId}/tasks/${taskId}`;
    try {
      const docRef = doc(db, 'users', userId, 'tasks', taskId);
      await updateDoc(docRef, updates);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  }

  public async deleteTask(userId: string, taskId: string): Promise<void> {
    const path = `users/${userId}/tasks/${taskId}`;
    try {
      const docRef = doc(db, 'users', userId, 'tasks', taskId);
      await deleteDoc(docRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Chat Conversations (/users/{userId}/conversations/{messageId})
  // ---------------------------------------------------------------------------
  public async getConversations(userId: string, maxLimit = 50): Promise<ChatRecord[]> {
    const path = `users/${userId}/conversations`;
    try {
      const colRef = collection(db, 'users', userId, 'conversations');
      const snap = await getDocs(colRef);
      const messages: ChatRecord[] = [];
      snap.forEach((d) => messages.push(d.data() as ChatRecord));
      return messages
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .slice(-maxLimit);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  }

  public async saveConversationMessage(userId: string, role: 'user' | 'assistant', content: string): Promise<ChatRecord> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const path = `users/${userId}/conversations/${messageId}`;

    const record: ChatRecord = {
      id: messageId,
      userId,
      role,
      content,
      timestamp: new Date().toISOString(),
    };

    try {
      const docRef = doc(db, 'users', userId, 'conversations', messageId);
      await setDoc(docRef, record);
      return record;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Agent Execution Logs (/users/{userId}/agent_logs/{logId})
  // ---------------------------------------------------------------------------
  public async getAgentLogs(userId: string, maxLimit = 30): Promise<AgentLogRecord[]> {
    const path = `users/${userId}/agent_logs`;
    try {
      const colRef = collection(db, 'users', userId, 'agent_logs');
      const snap = await getDocs(colRef);
      const logs: AgentLogRecord[] = [];
      snap.forEach((d) => logs.push(d.data() as AgentLogRecord));
      return logs
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, maxLimit);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  }

  public async saveAgentLog(userId: string, log: Omit<AgentLogRecord, 'id' | 'userId' | 'timestamp'> & { id?: string }): Promise<AgentLogRecord> {
    const logId = log.id || `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const path = `users/${userId}/agent_logs/${logId}`;

    const record: AgentLogRecord = {
      ...log,
      id: logId,
      userId,
      timestamp: new Date().toISOString(),
    };

    try {
      const docRef = doc(db, 'users', userId, 'agent_logs', logId);
      await setDoc(docRef, record);
      return record;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, path);
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Persistent Agent Memory (/users/{userId}/agent_memory/{memoryId})
  // ---------------------------------------------------------------------------
  public async getAgentMemories(userId: string): Promise<AgentMemoryRecord[]> {
    const path = `users/${userId}/agent_memory`;
    try {
      const colRef = collection(db, 'users', userId, 'agent_memory');
      const snap = await getDocs(colRef);
      const memories: AgentMemoryRecord[] = [];
      snap.forEach((d) => memories.push(d.data() as AgentMemoryRecord));
      return memories.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, path);
    }
  }

  public async saveAgentMemory(
    userId: string,
    memory: { agentId: string; category: string; content: string; id?: string }
  ): Promise<AgentMemoryRecord> {
    const memoryId = memory.id || `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const path = `users/${userId}/agent_memory/${memoryId}`;

    const record: AgentMemoryRecord = {
      id: memoryId,
      userId,
      agentId: memory.agentId,
      category: memory.category,
      content: memory.content,
      updatedAt: new Date().toISOString(),
    };

    try {
      const docRef = doc(db, 'users', userId, 'agent_memory', memoryId);
      await setDoc(docRef, record, { merge: true });
      return record;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  }

  public async deleteAgentMemory(userId: string, memoryId: string): Promise<void> {
    const path = `users/${userId}/agent_memory/${memoryId}`;
    try {
      const docRef = doc(db, 'users', userId, 'agent_memory', memoryId);
      await deleteDoc(docRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  }
}

export const firestoreService = new FirestoreDataService();
