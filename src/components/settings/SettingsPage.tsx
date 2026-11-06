import { useState } from 'react';
import {
  Server,
  Key,
  Database,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Code2,
  FileText,
  Download,
  Upload,
  Sparkles,
} from 'lucide-react';
import { fastApiClient, ConnectionTestResult } from '../../services/fastapiClient';
import { FastAPISettings } from '../../types';

interface SettingsPageProps {
  fastApiSettings: FastAPISettings;
  onUpdateFastAPISettings: (settings: FastAPISettings) => void;
  onTestConnection: (url?: string) => Promise<ConnectionTestResult>;
  geminiConfigured: boolean;
  onExportAll: () => void;
  onImportAll: (data: string) => boolean;
}

export function SettingsPage({
  fastApiSettings,
  onUpdateFastAPISettings,
  onTestConnection,
  geminiConfigured,
  onExportAll,
  onImportAll,
}: SettingsPageProps) {
  const [formData, setFormData] = useState<FastAPISettings>(fastApiSettings);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeCodeTab, setActiveCodeTab] = useState<'main' | 'graph' | 'state' | 'reqs'>('main');
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const boilerplate = fastApiClient.getPythonBoilerplateCode();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateFastAPISettings(formData);
    setTestResult(null);
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await onTestConnection(formData.baseUrl);
      setTestResult(res);
    } finally {
      setIsTesting(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = onImportAll(content);
      if (success) {
        setImportStatus('State successfully restored.');
      } else {
        setImportStatus('Invalid JSON backup file.');
      }
      setTimeout(() => setImportStatus(null), 3000);
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="pb-4 border-b border-neutral-800">
        <h2 className="text-xl font-bold tracking-tight text-white">
          System & Backend Integration Settings
        </h2>
        <p className="text-xs text-neutral-400 mt-0.5">
          Configure Python FastAPI + LangGraph endpoints, verify runtime health, and inspect API contracts.
        </p>
      </div>

      {/* Section 1: FastAPI + LangGraph Connection */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <Server className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">Python FastAPI & LangGraph Backend</h3>
          </div>
          <span className="text-xs text-neutral-400 font-mono">
            Protocol: REST + LangGraph StateGraph
          </span>
        </div>

        <form onSubmit={handleSave} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-neutral-300 font-medium block mb-1">
                FastAPI Server Endpoint URL
              </label>
              <input
                type="url"
                required
                value={formData.baseUrl}
                onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                placeholder="http://localhost:8000"
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500 font-mono text-xs"
              />
              <span className="text-[11px] text-neutral-400 mt-1 block">
                Target endpoint of your local or remote FastAPI application.
              </span>
            </div>

            <div>
              <label className="text-neutral-300 font-medium block mb-1">
                LangGraph StateGraph ID
              </label>
              <input
                type="text"
                required
                value={formData.graphId}
                onChange={(e) => setFormData({ ...formData, graphId: e.target.value })}
                placeholder="intellitask_core_graph"
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500 font-mono text-xs"
              />
              <span className="text-[11px] text-neutral-400 mt-1 block">
                Target graph workflow identifier registered in FastAPI.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-neutral-300 font-medium block mb-1">
                API Key / Bearer Secret (Optional)
              </label>
              <input
                type="password"
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                placeholder="Bearer token or API key for protected routes"
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 placeholder-neutral-500 focus:outline-hidden focus:border-indigo-500 font-mono text-xs"
              />
            </div>

            <div>
              <label className="text-neutral-300 font-medium block mb-1">
                Timeout (Seconds)
              </label>
              <input
                type="number"
                min="5"
                max="120"
                value={formData.timeoutSeconds}
                onChange={(e) =>
                  setFormData({ ...formData, timeoutSeconds: parseInt(e.target.value, 10) || 15 })
                }
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-neutral-100 focus:outline-hidden focus:border-indigo-500 font-mono text-xs"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={handleTest}
              disabled={isTesting}
              className="flex items-center gap-1.5 px-3 py-2 bg-neutral-950 hover:bg-neutral-850 border border-neutral-800 text-neutral-200 rounded-lg text-xs font-medium transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Testing Connectivity...' : 'Test Backend Connection'}</span>
            </button>

            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
            >
              Save Configuration
            </button>
          </div>
        </form>

        {/* Real Connection Test Diagnostics */}
        {testResult && (
          <div
            className={`p-4 rounded-xl border text-xs space-y-2 ${
              testResult.connected
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                : 'bg-neutral-950 border-neutral-800 text-neutral-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {testResult.connected ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-neutral-400 shrink-0" />
                )}
                <span className="font-semibold">
                  {testResult.connected
                    ? 'FastAPI Backend Online & Reachable'
                    : 'FastAPI Backend Offline / Unreachable'}
                </span>
              </div>
              {testResult.latencyMs !== undefined && (
                <span className="font-mono tabular-nums text-[11px] text-neutral-400">
                  Latency: {testResult.latencyMs}ms
                </span>
              )}
            </div>

            <div className="text-[11px] text-neutral-400 font-mono">
              Target: {testResult.endpoint}
            </div>

            {testResult.recommendation && (
              <p className="text-[11px] text-neutral-400 leading-relaxed bg-neutral-900/60 p-2.5 rounded-lg border border-neutral-800/80">
                {testResult.recommendation}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Section 2: Gemini Core AI Engine */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-white">Gemini Autonomous Core</h3>
          </div>
          <span className="text-xs font-mono text-neutral-400">
            Model: gemini-2.5-flash
          </span>
        </div>

        <div className="text-xs text-neutral-300 space-y-2">
          <p className="leading-relaxed">
            IntelliTask AI uses Google Gemini 2.5 Flash server-side proxy routes for objective decomposition, multi-turn assistant reasoning, and deep technical research.
          </p>

          <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-lg flex items-center justify-between">
            <span className="text-neutral-400">Status:</span>
            <span className={geminiConfigured ? 'text-emerald-400 font-medium' : 'text-neutral-400'}>
              {geminiConfigured ? 'Live & Configured (process.env.GEMINI_API_KEY)' : 'API Key Pending in Secrets/Env'}
            </span>
          </div>
        </div>
      </div>

      {/* Section 3: Python FastAPI + LangGraph Ready-to-Run Code Scaffold */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
          <div>
            <h3 className="text-sm font-semibold text-white">
              Python FastAPI + LangGraph Scaffold
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Copy-pasteable backend files to launch the Python service locally on port 8000.
            </p>
          </div>

          {/* Code Tabs */}
          <div className="inline-flex items-center gap-1 p-1 bg-neutral-950 border border-neutral-800 rounded-lg">
            <button
              onClick={() => setActiveCodeTab('main')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeCodeTab === 'main' ? 'bg-neutral-800 text-white' : 'text-neutral-400'
              }`}
            >
              main.py
            </button>
            <button
              onClick={() => setActiveCodeTab('graph')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeCodeTab === 'graph' ? 'bg-neutral-800 text-white' : 'text-neutral-400'
              }`}
            >
              graph.py
            </button>
            <button
              onClick={() => setActiveCodeTab('state')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeCodeTab === 'state' ? 'bg-neutral-800 text-white' : 'text-neutral-400'
              }`}
            >
              state.py
            </button>
            <button
              onClick={() => setActiveCodeTab('reqs')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeCodeTab === 'reqs' ? 'bg-neutral-800 text-white' : 'text-neutral-400'
              }`}
            >
              requirements.txt
            </button>
          </div>
        </div>

        {/* Code Content Box */}
        <div className="relative bg-neutral-950 border border-neutral-800 rounded-xl p-4 font-mono text-xs overflow-x-auto max-h-[380px]">
          <button
            onClick={() => {
              const content =
                activeCodeTab === 'main'
                  ? boilerplate.mainPy
                  : activeCodeTab === 'graph'
                  ? boilerplate.graphPy
                  : activeCodeTab === 'state'
                  ? boilerplate.statePy
                  : boilerplate.requirementsTxt;
              copyToClipboard(content, activeCodeTab);
            }}
            className="absolute right-3 top-3 flex items-center gap-1 px-2.5 py-1 text-[11px] bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-md transition-colors"
          >
            {copiedKey === activeCodeTab ? (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy Code</span>
              </>
            )}
          </button>

          <pre className="text-neutral-300 leading-relaxed">
            {activeCodeTab === 'main' && boilerplate.mainPy}
            {activeCodeTab === 'graph' && boilerplate.graphPy}
            {activeCodeTab === 'state' && boilerplate.statePy}
            {activeCodeTab === 'reqs' && boilerplate.requirementsTxt}
          </pre>
        </div>
      </div>

      {/* Section 4: Data Management & Backup */}
      <div className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-semibold text-white">Application State Backup & Migration</h3>
        <p className="text-xs text-neutral-400">
          Export your current task backlog, plan milestones, and agent configurations as JSON for versioning or team handoff.
        </p>

        {importStatus && (
          <div className="p-3 bg-neutral-950 border border-neutral-800 text-xs text-neutral-300 rounded-lg">
            {importStatus}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onExportAll}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-neutral-200 hover:text-white bg-neutral-950 border border-neutral-800 hover:bg-neutral-850 rounded-lg transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Application State JSON</span>
          </button>

          <label className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-neutral-200 hover:text-white bg-neutral-950 border border-neutral-800 hover:bg-neutral-850 rounded-lg cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>Restore State from JSON</span>
            <input
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
