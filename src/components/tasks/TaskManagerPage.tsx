import { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Circle,
  Clock,
  Trash2,
  Download,
  RotateCcw,
  LayoutGrid,
  List,
  AlertCircle,
  Tag,
  User,
} from 'lucide-react';
import { Task, TaskPriority, TaskStatus } from '../../types';
import { Modal, SegmentedTabs } from '../common/UIComponents';

interface TaskManagerPageProps {
  tasks: Task[];
  onAddTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  selectedTask?: Task | null;
  onSelectTask: (task: Task | null) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function TaskManagerPage({
  tasks,
  onAddTask,
  onUpdateTask,
  onDeleteTask,
  onToggleSubtask,
  selectedTask,
  onSelectTask,
  isLoading = false,
  error = null,
}: TaskManagerPageProps) {
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form states for new task
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const [newAgent, setNewAgent] = useState('Supervisor');
  const [newTags, setNewTags] = useState('Architecture, Python');
  const [newHours, setNewHours] = useState('8');
  const [newSubtasks, setNewSubtasks] = useState('');

  const statusColumns: { id: TaskStatus; label: string }[] = [
    { id: 'todo', label: 'To-Do' },
    { id: 'in_progress', label: 'In Progress' },
    { id: 'in_review', label: 'In Review' },
    { id: 'completed', label: 'Completed' },
    { id: 'blocked', label: 'Blocked' },
  ];

  const agentOptions = [
    'Supervisor',
    'Research Specialist',
    'Planner Architect',
    'Code Generator',
    'QA Reviewer',
    'Unassigned',
  ];

  // Filtering
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        task.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesPriority =
        priorityFilter === 'all' || task.priority === priorityFilter;

      const matchesAgent =
        agentFilter === 'all' || task.assignedAgent === agentFilter;

      return matchesSearch && matchesPriority && matchesAgent;
    });
  }, [tasks, searchQuery, priorityFilter, agentFilter]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const parsedSubtasks = newSubtasks
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((t, idx) => ({ id: `sub-${Date.now()}-${idx}`, title: t, completed: false }));

    const parsedTags = newTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    onAddTask({
      title: newTitle.trim(),
      description: newDescription.trim(),
      status: 'todo',
      priority: newPriority,
      assignedAgent: newAgent,
      tags: parsedTags,
      dueDate: new Date(Date.now() + 5 * 86400000).toISOString(),
      estimatedHours: parseInt(newHours, 10) || 4,
      subtasks: parsedSubtasks,
      source: 'manual',
    });

    // Reset & close
    setNewTitle('');
    setNewDescription('');
    setNewTags('Architecture, Python');
    setNewSubtasks('');
    setIsAddModalOpen(false);
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(tasks, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `intellitask-export-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Controls Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Task Orchestration Backlog
          </h2>
          <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
            <span className="font-mono tabular-nums">{filteredTasks.length} tasks matching</span>
            <span aria-hidden="true">·</span>
            <span>Local persistence active</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* View Mode Toggle */}
          <div className="inline-flex items-center gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-lg">
            <button
              onClick={() => setViewMode('board')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'board'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Kanban Board View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Table List View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Export & Reset */}
          <button
            onClick={handleExportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-300 hover:text-white bg-neutral-900 border border-neutral-800 rounded-lg hover:bg-neutral-800 transition-colors"
            title="Export tasks as JSON"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Primary Create Button */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Task</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3.5 bg-rose-950/50 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Firestore Database Notice</span>
            <span className="text-[11px] text-rose-300/90 leading-relaxed block">{error}</span>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="p-6 bg-neutral-900/60 border border-neutral-800 rounded-xl flex items-center justify-center gap-3 text-xs text-neutral-400">
          <span className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          <span>Synchronizing tasks with Firestore collection...</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID, title, keyword or tag..."
            className="w-full pl-9 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* Priority filter */}
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-300 focus:outline-hidden focus:border-indigo-500"
        >
          <option value="all">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {/* Agent filter */}
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-300 focus:outline-hidden focus:border-indigo-500"
        >
          <option value="all">All Agents</option>
          {agentOptions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {/* Kanban Board View */}
      {viewMode === 'board' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
          {statusColumns.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.id);
            return (
              <div
                key={col.id}
                className="bg-neutral-900/50 border border-neutral-800/80 rounded-xl p-3 min-h-[420px] flex flex-col"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-neutral-800">
                  <span className="text-xs font-semibold text-neutral-200">{col.label}</span>
                  <span className="text-[11px] font-mono tabular-nums text-neutral-400">
                    {colTasks.length}
                  </span>
                </div>

                {/* Column Cards */}
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[680px]">
                  {colTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => onSelectTask(task)}
                      className="bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-lg p-3.5 cursor-pointer transition-all hover:shadow-sm space-y-2 group"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono text-neutral-400">{task.id}</span>
                        <span
                          className={`font-mono text-[10px] uppercase font-semibold ${
                            task.priority === 'urgent'
                              ? 'text-rose-400'
                              : task.priority === 'high'
                              ? 'text-amber-400'
                              : 'text-neutral-400'
                          }`}
                        >
                          {task.priority}
                        </span>
                      </div>

                      <h4 className="text-xs font-semibold text-white group-hover:text-indigo-300 transition-colors line-clamp-2">
                        {task.title}
                      </h4>

                      <p className="text-[11px] text-neutral-400 line-clamp-2">
                        {task.description}
                      </p>

                      {/* Clean unboxed metadata with typographic separators */}
                      <div className="pt-2 border-t border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-400">
                        <span className="truncate max-w-[100px]">{task.assignedAgent}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{task.estimatedHours}h</span>
                        {task.subtasks.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {task.subtasks.filter((s) => s.completed).length}/
                              {task.subtasks.length}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}

                  {colTasks.length === 0 && (
                    <div className="h-28 flex flex-col items-center justify-center text-center p-3 text-neutral-400 border border-dashed border-neutral-800/80 rounded-lg">
                      <span className="text-[11px]">No tasks in queue</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List / Table View */
        <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-400 font-medium bg-neutral-950/60">
                  <th className="py-3 px-4 w-24">ID</th>
                  <th className="py-3 px-4">Task Title</th>
                  <th className="py-3 px-4 w-32">Status</th>
                  <th className="py-3 px-4 w-28">Priority</th>
                  <th className="py-3 px-4 w-36">Assigned Agent</th>
                  <th className="py-3 px-4 w-24 text-right">Est. Hours</th>
                  <th className="py-3 px-4 w-24 text-center">Subtasks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    onClick={() => onSelectTask(task)}
                    className="hover:bg-neutral-800/30 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-neutral-400">{task.id}</td>
                    <td className="py-3 px-4 font-medium text-neutral-100 hover:text-indigo-300">
                      <div>{task.title}</div>
                      <div className="text-[11px] text-neutral-400 truncate max-w-md">
                        {task.description}
                      </div>
                    </td>
                    <td className="py-3 px-4 capitalize text-neutral-300">
                      {task.status.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-4 capitalize">
                      <span
                        className={`font-mono text-[11px] ${
                          task.priority === 'urgent'
                            ? 'text-rose-400'
                            : task.priority === 'high'
                            ? 'text-amber-400'
                            : 'text-neutral-400'
                        }`}
                      >
                        {task.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-neutral-300 truncate">{task.assignedAgent}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-neutral-300">
                      {task.estimatedHours}h
                    </td>
                    <td className="py-3 px-4 text-center font-mono tabular-nums text-neutral-400">
                      {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail / Edit Modal */}
      {selectedTask && (
        <Modal
          isOpen={Boolean(selectedTask)}
          onClose={() => onSelectTask(null)}
          title={selectedTask.title}
          description={`Identifier: ${selectedTask.id} · Created ${new Date(
            selectedTask.createdAt
          ).toLocaleDateString()}`}
        >
          <div className="space-y-5 text-xs">
            {/* Description */}
            <div>
              <span className="text-neutral-400 font-medium block mb-1">Description</span>
              <p className="text-neutral-200 leading-relaxed bg-neutral-950/60 p-3 rounded-lg border border-neutral-800">
                {selectedTask.description}
              </p>
            </div>

            {/* Status & Priority Selectors */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-neutral-400 font-medium block mb-1">Status</label>
                <select
                  value={selectedTask.status}
                  onChange={(e) => {
                    const newStatus = e.target.value as TaskStatus;
                    onUpdateTask(selectedTask.id, { status: newStatus });
                    onSelectTask({ ...selectedTask, status: newStatus });
                  }}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-hidden focus:border-indigo-500"
                >
                  {statusColumns.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-neutral-400 font-medium block mb-1">Priority</label>
                <select
                  value={selectedTask.priority}
                  onChange={(e) => {
                    const newPriority = e.target.value as TaskPriority;
                    onUpdateTask(selectedTask.id, { priority: newPriority });
                    onSelectTask({ ...selectedTask, priority: newPriority });
                  }}
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-hidden focus:border-indigo-500"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            {/* Subtasks checklist */}
            <div>
              <span className="text-neutral-400 font-medium block mb-2">
                Subtasks ({selectedTask.subtasks.filter((s) => s.completed).length}/
                {selectedTask.subtasks.length})
              </span>
              <div className="space-y-2">
                {selectedTask.subtasks.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => {
                      onToggleSubtask(selectedTask.id, st.id);
                      onSelectTask({
                        ...selectedTask,
                        subtasks: selectedTask.subtasks.map((item) =>
                          item.id === st.id ? { ...item, completed: !item.completed } : item
                        ),
                      });
                    }}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-800 hover:bg-neutral-850 text-left transition-colors"
                  >
                    {st.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-neutral-500 shrink-0" />
                    )}
                    <span
                      className={`text-xs ${
                        st.completed ? 'line-through text-neutral-500' : 'text-neutral-200'
                      }`}
                    >
                      {st.title}
                    </span>
                  </button>
                ))}
                {selectedTask.subtasks.length === 0 && (
                  <span className="text-neutral-500 italic">No checklist items defined.</span>
                )}
              </div>
            </div>

            {/* Metadata Footer and Actions */}
            <div className="pt-4 border-t border-neutral-800 flex items-center justify-between">
              <div className="text-[11px] text-neutral-400">
                Agent: <span className="text-neutral-200">{selectedTask.assignedAgent}</span>
              </div>
              <button
                onClick={() => {
                  onDeleteTask(selectedTask.id);
                  onSelectTask(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/50 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Task</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Task Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create New Backlog Task"
        description="Add a task item to the IntelliTask orchestration engine."
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
          <div>
            <label className="text-neutral-300 font-medium block mb-1">Task Title *</label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Implement LangGraph Checkpoint Store"
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="text-neutral-300 font-medium block mb-1">Description</label>
            <textarea
              rows={3}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Provide context, acceptance criteria, or technical bounds..."
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-neutral-300 font-medium block mb-1">Priority</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-hidden focus:border-indigo-500"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="text-neutral-300 font-medium block mb-1">Assign Agent</label>
              <select
                value={newAgent}
                onChange={(e) => setNewAgent(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-hidden focus:border-indigo-500"
              >
                {agentOptions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-neutral-300 font-medium block mb-1">Est. Hours</label>
              <input
                type="number"
                min="1"
                value={newHours}
                onChange={(e) => setNewHours(e.target.value)}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="text-neutral-300 font-medium block mb-1">Tags (comma-separated)</label>
              <input
                type="text"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                placeholder="LangGraph, Security, API"
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-neutral-300 font-medium block mb-1">
              Subtasks (one per line)
            </label>
            <textarea
              rows={2}
              value={newSubtasks}
              onChange={(e) => setNewSubtasks(e.target.value)}
              placeholder="Define state interface&#10;Verify checkpoint serialization"
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          <div className="pt-3 border-t border-neutral-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-xs text-neutral-300 hover:text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
            >
              Create Task
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
