'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Loader2, CheckCircle2, AlertCircle, Trash2, Eye, EyeOff, Wifi, WifiOff } from 'lucide-react';
import { saveAiConfig, removeAiConfig, getAiStatus, testAiConnectionAction } from '@/app/actions/ai-config';
import type { AiConfigStatusResult } from '@/app/actions/ai-config';

const PROVIDERS = [
  { id: 'google', name: 'Google AI (Gemini)', defaultModel: 'gemini-3.5-flash', supportsVision: true },
  { id: 'groq', name: 'Groq', defaultModel: 'llama-4-scout-17b', supportsVision: true },
  { id: 'openai', name: 'OpenAI', defaultModel: 'gpt-5.4-mini', supportsVision: true },
  { id: 'anthropic', name: 'Anthropic (Claude)', defaultModel: 'claude-haiku-4.5', supportsVision: true },
];

export function SettingsAiConfig() {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AiConfigStatusResult | null>(null);

  // Form state
  const [provider, setProvider] = useState('google');
  const [model, setModel] = useState('gemini-3.5-flash');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showKey, setShowKey] = useState(false);

  // Actions
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const result = await getAiStatus();
      if (result.status) {
        setStatus(result.status);
        setProvider(result.status.provider);
        setModel(result.status.model);
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleProviderChange = (newProvider: string) => {
    setProvider(newProvider);
    const prov = PROVIDERS.find((p) => p.id === newProvider);
    if (prov) {
      setModel(prov.defaultModel);
    }
  };

  const handleTest = async () => {
    if (!apiKey) {
      setTestResult('Enter an API key to test the connection.');
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testAiConnectionAction({ provider, model, apiKey, baseUrl: baseUrl || undefined });

      if (result.success) {
        if (result.hasVision) {
          setTestResult('✅ Connection successful! Model supports image identification.');
        } else {
          setTestResult(
            "✅ Connection successful! ⚠️ This model does NOT support image identification. " +
            "You'll need to enter the plant name manually for AI suggestions."
          );
        }
      } else {
        setTestResult(`❌ ${result.error || 'Connection failed.'}`);
      }
    } catch {
      setTestResult('❌ Test failed. Please check your inputs.');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!provider || !model || !apiKey) {
      setError('Provider, model, and API key are required.');
      return;
    }

    setSaving(true);
    try {
      const result = await saveAiConfig({ provider, model, apiKey, baseUrl: baseUrl || undefined });
      if (result.success && result.status) {
        setStatus(result.status);
        setSuccess('AI configuration saved!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || 'Failed to save');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setDeleting(true);
    try {
      const result = await removeAiConfig();
      if (result.success) {
        setStatus(null);
        setApiKey('');
        setBaseUrl('');
        setProvider('google');
        setModel('gemini-3.5-flash');
        setShowDeleteConfirm(false);
        setSuccess('AI configuration removed. The app will use the default provider.');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || 'Failed to remove');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
      </div>
    );
  }

  const isConfigured = !!status?.configured;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
          isConfigured ? 'bg-emerald-100' : 'bg-stone-100/50'
        }`}>
          <Sparkles className={`h-5 w-5 ${isConfigured ? 'text-emerald-600' : 'text-stone-400'}`} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-stone-800">AI Provider</h2>
          <p className="text-xs text-stone-400">
            {isConfigured
              ? `Using your ${status!.provider} account (${status!.model})`
              : 'Using the default AI provider. Configure your own for higher limits.'}
          </p>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200/50 px-4 py-3 mb-4 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200/50 px-4 py-3 mb-4 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1.5">Provider</label>
            <select
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value)}
              className="w-full rounded-xl border border-stone-200/50 bg-white/80 px-4 py-2.5 text-sm text-stone-900 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id} className="bg-white">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1.5">Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={PROVIDERS.find((p) => p.id === provider)?.defaultModel || 'Model name'}
              className="w-full rounded-xl border border-stone-200/50 bg-white/80 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1.5">API Key</label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={isConfigured ? 'Enter new key to update...' : 'sk-...'}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 pr-10 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/20 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
            >
              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1.5">
            Base URL <span className="text-stone-400 font-normal">(optional — for custom endpoints)</span>
          </label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com/v1/chat/completions"
            className="w-full rounded-xl border border-stone-200/50 bg-white/80 px-4 py-2.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
          />
        </div>

        {/* Test result */}
        {testResult && (
          <div className={`rounded-xl px-4 py-3 text-sm ${
            testResult.startsWith('✅')
              ? 'bg-emerald-50 border border-emerald-200/50 text-emerald-700'
              : testResult.startsWith('❌')
              ? 'bg-red-50 border border-red-200/50 text-red-600'
              : 'bg-amber-50 border border-amber-200/50 text-amber-700'
          }`}>
            {testResult}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || !apiKey}
            className="rounded-xl border border-stone-200/50 px-4 py-2.5 text-sm text-stone-500 hover:text-stone-800 hover:bg-stone-100/50 disabled:opacity-50 transition-all flex items-center gap-1.5"
          >
            {testing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Wifi className="h-4 w-4" />
                Test Connection
              </>
            )}
          </button>

          <button
            type="submit"
            disabled={saving || !apiKey}
            className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </span>
            ) : isConfigured ? (
              'Update Configuration'
            ) : (
              'Save Configuration'
            )}
          </button>

          {isConfigured && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="rounded-xl border border-red-300/50 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-all flex items-center gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              Remove
            </button>
          )}
        </div>
      </form>

      {showDeleteConfirm && (
        <div className="mt-4 rounded-xl bg-red-50 border border-red-200/50 p-4">
          <p className="text-sm text-red-700 mb-3">
            Remove your AI configuration? The app will fall back to the default provider.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleRemove}
              disabled={deleting}
              className="rounded-lg bg-red-500 px-4 py-2 text-xs font-semibold text-white hover:bg-red-400 disabled:opacity-50 transition-all"
            >
              {deleting ? 'Removing...' : 'Yes, remove'}
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-lg border border-stone-200/50 px-4 py-2 text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-100/50 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
