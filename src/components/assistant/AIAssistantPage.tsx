import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { geminiService, ChatMessage } from '../../services/geminiService';
import { Task } from '../../types';

import { firestoreService } from '../../services/firestoreService';

interface AIAssistantPageProps {
  tasks: Task[];
  geminiConfigured: boolean;
  userId?: string;
}

export function AIAssistantPage({ tasks, geminiConfigured, userId }: AIAssistantPageProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content:
        'Greetings. I am your IntelliTask Autonomous Copilot. I can assist in decomposing tasks, reviewing LangGraph state schemas, diagnosing backend bottlenecks, and formulating execution workflows. How can I assist your engineering pipeline today?',
      timestamp: new Date().toISOString(),
      status: 'received',
    },
  ]);

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState('Senior Orchestration Assistant');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load user conversation history from Firestore
  useEffect(() => {
    async function loadUserChat() {
      if (!userId) return;
      try {
        const history = await firestoreService.getConversations(userId, 30);
        if (history && history.length > 0) {
          setMessages(
            history.map((m) => ({
              id: m.id,
              role: m.role,
              content: m.content,
              timestamp: m.timestamp,
              status: 'received',
            }))
          );
        }
      } catch (err) {
        console.warn('Could not load chat history:', err);
      }
    }
    loadUserChat();
  }, [userId]);

  const roles = [
    'Senior Orchestration Assistant',
    'LangGraph Architecture Specialist',
    'FastAPI & Python Engineer',
    'Security & Invariants Auditor',
  ];

  const promptSuggestions = [
    'How do I structure the LangGraph checkpointer for task recovery?',
    'Review current task backlog and identify potential dependency cycles.',
    'Write a Pydantic v2 schema for task dispatch and audit log streams.',
    'Recommend architectural trade-offs between Celery and LangGraph workers.',
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || input).trim();
    if (!text || isLoading) return;

    setErrorMessage(null);
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      status: 'sent',
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Save to Firestore if user is authenticated
    if (userId) {
      firestoreService.saveConversationMessage(userId, 'user', text).catch((e) => {
        console.warn('Firestore conversation write error:', e);
      });
    }

    try {
      // Gather real system context
      const contextData = {
        totalTasks: tasks.length,
        inProgress: tasks.filter((t) => t.status === 'in_progress').map((t) => t.title),
        blocked: tasks.filter((t) => t.status === 'blocked').map((t) => t.title),
      };

      const history = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // Real network call to server-side Gemini proxy (no setTimeout simulation!)
      const res = await geminiService.sendAssistantMessage(
        history,
        selectedRole,
        contextData
      );

      const assistantMessage: ChatMessage = {
        id: `assist-${Date.now()}`,
        role: 'assistant',
        content: res.reply,
        timestamp: res.timestamp || new Date().toISOString(),
        status: 'received',
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (userId) {
        firestoreService.saveConversationMessage(userId, 'assistant', res.reply).catch((e) => {
          console.warn('Firestore assistant message write error:', e);
        });
      }
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          'Failed to receive response from Gemini Assistant endpoint. Please check your network or GEMINI_API_KEY configuration.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: 'Conversation history cleared. Ready for your next orchestration inquiry.',
        timestamp: new Date().toISOString(),
      },
    ]);
    setErrorMessage(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto p-4 lg:p-6">
      {/* Top Bar for Assistant */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">IntelliTask AI Copilot</h2>
            <div className="flex items-center gap-2 text-[11px] text-neutral-400">
              <span>Model: Gemini 2.5 Flash</span>
              <span aria-hidden="true">·</span>
              <span className={geminiConfigured ? 'text-emerald-400' : 'text-neutral-400'}>
                {geminiConfigured ? 'Live Connection' : 'API Key Required for AI Response'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Persona selector */}
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="px-2.5 py-1.5 text-xs bg-neutral-900 border border-neutral-800 text-neutral-200 rounded-lg focus:outline-hidden focus:border-indigo-500"
          >
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <button
            onClick={handleClearHistory}
            className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-neutral-900 rounded-lg transition-colors"
            title="Clear conversation"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Warning banner if Gemini key not set */}
      {!geminiConfigured && (
        <div className="mt-3 p-3 bg-neutral-900 border border-amber-800/60 rounded-lg flex items-start gap-2.5 text-xs text-neutral-300">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-300">Real AI API Notice: </span>
            In compliance with strict execution standards, real queries require a configured{' '}
            <code className="text-amber-200 font-mono text-[11px]">GEMINI_API_KEY</code>. No fake simulated responses are produced.
          </div>
        </div>
      )}

      {/* Chat Messages Log */}
      <div className="flex-1 overflow-y-auto py-6 space-y-4">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-2xl rounded-xl p-4 text-xs leading-relaxed ${
                  isUser
                    ? 'bg-indigo-600 text-white rounded-br-xs'
                    : 'bg-neutral-900/90 border border-neutral-800 text-neutral-200 rounded-bl-xs'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>

                <div
                  className={`mt-2 flex items-center justify-between gap-3 text-[10px] font-mono ${
                    isUser ? 'text-indigo-200' : 'text-neutral-500'
                  }`}
                >
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {!isUser && (
                    <button
                      onClick={() => handleCopy(msg.id, msg.content)}
                      className="hover:text-neutral-300 flex items-center gap-1 transition-colors"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-neutral-400 italic py-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <span>Executing query against Gemini 2.5 Flash...</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-lg text-xs text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Query Execution Error</p>
              <p className="text-[11px] mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts strip */}
      {messages.length <= 2 && (
        <div className="py-2">
          <span className="text-[11px] text-neutral-400 block mb-1.5">Suggested Prompts:</span>
          <div className="flex flex-wrap gap-2">
            {promptSuggestions.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(suggestion)}
                className="text-left text-xs text-neutral-300 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 px-3 py-1.5 rounded-lg transition-colors truncate max-w-md"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="pt-2 border-t border-neutral-800 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Inquire with ${selectedRole}...`}
          disabled={isLoading}
          className="flex-1 px-4 py-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500 transition-colors"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="flex items-center justify-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
