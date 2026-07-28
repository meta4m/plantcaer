'use client';

import { useState } from 'react';
import { Sparkles, Loader2, X, ExternalLink, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { LIGHT_REQUIREMENT_LABELS, TASK_TYPE_LABELS } from '@/lib/types';
import { UI_ICONS } from '@/lib/icons';
import { identifyPlantAction } from '@/app/actions/identify-plant';
import type { AiPlantSuggestion } from '@/lib/ai/types';
import type { LucideIcon } from 'lucide-react';

interface AiSuggestionOverlayProps {
  /** Base64-encoded photo (without data: prefix), or null for text-only mode */
  photoBase64: string | null;
  /** MIME type of the photo */
  photoMimeType: string | null;
  /** Plant name entered manually (for text-only mode when no vision) */
  plantName: string;
  /** Called when user accepts the suggestion */
  onAccept: (suggestion: AiPlantSuggestion) => void;
  /** Called to close without accepting */
  onDismiss: () => void;
  /** Whether AI provider is configured and available */
  aiEnabled: boolean;
}

/** Verification site links for plant name lookups */
const VERIFY_SITES: { name: string; url: (name: string) => string; icon: LucideIcon }[] = [
  {
    name: 'Wikipedia',
    url: (name: string) =>
      `https://en.wikipedia.org/wiki/${encodeURIComponent(name.replace(/ /g, '_'))}`,
    icon: UI_ICONS.book,
  },
  {
    name: 'Google Search',
    url: (name: string) =>
      `https://www.google.com/search?q=${encodeURIComponent(name + ' plant')}`,
    icon: UI_ICONS.search,
  },
  {
    name: 'iNaturalist',
    url: (name: string) =>
      `https://www.inaturalist.org/search?q=${encodeURIComponent(name)}`,
    icon: UI_ICONS.plants,
  },
  {
    name: 'Plant ID',
    url: (name: string) =>
      `https://www.plantid.com/search?q=${encodeURIComponent(name)}`,
    icon: UI_ICONS.camera,
  },
];

export function AiSuggestionOverlay({
  photoBase64,
  photoMimeType,
  plantName,
  onAccept,
  onDismiss,
  aiEnabled,
}: AiSuggestionOverlayProps) {
  const [state, setState] = useState<'idle' | 'loading' | 'result' | 'error'>('idle');
  const [result, setResult] = useState<AiPlantSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fallbackWarning, setFallbackWarning] = useState<string | null>(null);

  const hasPhoto = !!photoBase64 && !!photoMimeType;

  const startIdentification = async () => {
    if (!aiEnabled) return;

    setState('loading');
    setError(null);
    setResult(null);
    setFallbackWarning(null);

    try {
      const res = await identifyPlantAction(
        hasPhoto ? photoBase64! : null,
        hasPhoto ? photoMimeType! : null,
        !hasPhoto ? plantName : undefined,
      );

      if (res.warning) {
        // Store fallback warning to display in the result view
        setFallbackWarning(res.warning);
      }

      if (res.error) {
        setError(res.error);
        setState('error');
        return;
      }

      if (res.data && 'common_name' in res.data) {
        setResult(res.data as AiPlantSuggestion);
        setState('result');
      } else if (res.data) {
        // Got result but unexpected format
        setError('AI returned an unexpected response format.');
        setState('error');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI identification failed');
      setState('error');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div
        className="glass-card rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${
              state === 'result' ? 'bg-emerald-100' : 'bg-stone-100/50'
            }`}>
              <Sparkles className={`h-5 w-5 ${
                state === 'result' ? 'text-emerald-600' : 'text-stone-400'
              }`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-stone-800">AI Plant Identification</h3>
              <p className="text-xs text-stone-400">
                {hasPhoto
                  ? 'Identifying plant from your photo...'
                  : 'Identifying plant from name...'}
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="rounded-full bg-stone-100/50 p-1.5 text-stone-500 hover:text-stone-800 hover:bg-stone-200/50 transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {state === 'idle' && (
          <div className="text-center py-8 space-y-4">
            <p className="text-sm text-stone-500">
              {hasPhoto
                ? 'The AI will analyze your photo and suggest plant details, care requirements, and a care schedule.'
                : `The AI will suggest plant details and care requirements for "${plantName}".`}
            </p>
            <div className="text-xs text-stone-400 space-y-1">
              <p className="flex items-center justify-center gap-1.5">
                <UI_ICONS.warning size={12} className="text-[var(--color-overdue,#d97706)] flex-shrink-0" aria-hidden="true" />
                AI suggestions may not be accurate. Always verify before accepting.
              </p>
              <p>Verification links will be provided for each suggestion.</p>
            </div>
            <button
              onClick={startIdentification}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-400 transition-all active:scale-[0.98]"
            >
              <Sparkles className="h-4 w-4" />
              Identify Plant
            </button>
          </div>
        )}

        {state === 'loading' && (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-emerald-400 mb-4" />
            <p className="text-sm text-stone-500">Analyzing plant information...</p>
            <p className="text-xs text-stone-400 mt-1">This may take a few seconds</p>
          </div>
        )}

        {state === 'error' && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200/50 px-4 py-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">AI identification failed</p>
                <p className="text-red-600/70 mt-0.5">{error || 'Unknown error'}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={startIdentification}
                className="flex-1 rounded-xl bg-emerald-100 px-4 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-200 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </button>
              <button
                onClick={onDismiss}
                className="flex-1 rounded-xl border border-stone-200/50 px-4 py-2.5 text-sm text-stone-500 hover:text-stone-800 hover:bg-stone-100/50 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {state === 'result' && result && (
          <div className="space-y-4">
            {/* Suggestion details */}
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-stone-800">Plant Name</p>
                  <div className="flex gap-1">
                    {VERIFY_SITES.map((site) => (
                      <a
                        key={site.name}
                        href={site.url(result.common_name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-stone-100/50 px-2 py-1 text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-200/50 transition-all flex items-center gap-1"
                        title={`Verify on ${site.name}`}
                      >
                        <site.icon className="h-3 w-3" aria-hidden="true" />
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                </div>
                <p className="text-stone-800 font-medium mt-0.5">
                  {result.common_name}
                  {result.scientific_name && (
                    <span className="text-stone-400 italic ml-2 font-normal">
                      {result.scientific_name}
                    </span>
                  )}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {result.light_requirement && (
                  <div className="rounded-lg bg-stone-100/50 p-3">
                    <p className="text-xs text-stone-400 mb-0.5">Light</p>
                    <p className="flex items-center gap-1.5 text-stone-800">
                      <UI_ICONS.sun size={14} className="text-[var(--color-sun)] flex-shrink-0" aria-hidden="true" />
                      {LIGHT_REQUIREMENT_LABELS[result.light_requirement]}
                    </p>
                  </div>
                )}
                <div className="rounded-lg bg-stone-100/50 p-3"><p className="text-xs text-stone-400 mb-0.5">Temperature</p>
                    <p className="flex items-center gap-1.5 text-stone-800">
                      <UI_ICONS.thermometer size={14} className="text-[var(--color-terracotta)] flex-shrink-0" aria-hidden="true" />
                      {result.min_temp}°C – {result.max_temp}°C
                    </p>
                </div>
                <div className="rounded-lg bg-stone-100/50 p-3"><p className="text-xs text-stone-400 mb-0.5">Humidity</p>
                    <p className="flex items-center gap-1.5 text-stone-800">
                      <UI_ICONS.droplets size={14} className="text-[var(--color-water)] flex-shrink-0" aria-hidden="true" />
                      {result.humidity_min}%+
                    </p>
                </div>
                <div className="rounded-lg bg-stone-100/50 p-3"><p className="text-xs text-stone-400 mb-0.5">Care Tasks</p>
                    <p className="flex items-center gap-1.5 text-stone-800">
                      <UI_ICONS.clipboard size={14} className="text-stone-400 flex-shrink-0" aria-hidden="true" />
                      {result.care_tasks?.length || 0} suggested
                    </p>
                </div>
              </div>

              {result.notes && (
                <div className="text-sm text-stone-600 bg-stone-100/50 rounded-xl p-3">
                  <p className="text-xs text-stone-400 mb-1">Care Notes</p>
                  <p>{result.notes}</p>
                </div>
              )}

              {/* Care tasks */}
              {result.care_tasks && result.care_tasks.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-2">
                    Suggested Care Schedule
                  </p>
                  <div className="space-y-1.5">
                    {result.care_tasks.map((task, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-stone-500 bg-stone-100/30 rounded-lg px-3 py-2">
                        <span>{TASK_TYPE_LABELS[task.task_type]}</span>
                        <span className="text-stone-400">·</span>
                        <span>Every {task.frequency_days}d</span>
                        {task.amount && (
                          <>
                            <span className="text-stone-400">·</span>
                            <span>{task.amount}</span>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fallback warning (user's provider failed, using default) */}
              {fallbackWarning && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200/50 px-4 py-3 text-xs text-amber-700">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <p>{fallbackWarning}</p>
                </div>
              )}

              {/* Verify warning */}
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200/50 px-4 py-3 text-xs text-amber-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>
                  AI-generated information may be inaccurate. Use the verification links above to check
                  details on Wikipedia, Google, or plant identification sites before accepting.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => onAccept(result)}
                className="flex-1 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-400 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Accept & Fill Form
              </button>
              <button
                onClick={onDismiss}
                className="rounded-xl border border-stone-200/50 px-4 py-2.5 text-sm text-stone-500 hover:text-stone-800 hover:bg-stone-100/50 transition-all flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Wrapper component: the small AI icon button shown on the form */
export function AiIdentifyButton({
  enabled,
  loading,
  onClick,
}: {
  enabled: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled || loading}
      className={`relative rounded-xl px-3 py-2 text-xs font-medium transition-all flex items-center gap-1.5 ${
        !enabled
          ? 'bg-stone-100/50 text-stone-300 cursor-not-allowed'
          : loading
          ? 'bg-emerald-100 text-emerald-600'
          : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 active:scale-[0.98]'
      }`}
      title={enabled ? 'Identify with AI' : 'AI not configured — configure in Settings'}
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Sparkles className="h-3.5 w-3.5" />
      )}
      {loading ? 'Identifying...' : 'AI Identify'}
      {!enabled && (
        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-stone-400" />
      )}
      {enabled && !loading && (
        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
      )}
    </button>
  );
}

/** Nickname generator button */
export function AiNicknameButton({
  enabled,
  plantName,
  onGenerated,
}: {
  enabled: boolean;
  plantName: string;
  onGenerated: (nickname: string) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateNickname = async () => {
    if (!enabled || !plantName) return;
    setGenerating(true);
    setError(null);

    try {
      const res = await identifyPlantAction(null, null, plantName, true);
      if (res.data && 'nickname' in res.data) {
        onGenerated((res.data as { nickname: string }).nickname);
      } else if (res.error) {
        setError(res.error);
      }
    } catch {
      setError('Failed to generate nickname');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={generateNickname}
        disabled={!enabled || generating || !plantName}
        className="rounded-lg bg-stone-100/50 px-2.5 py-1.5 text-xs text-stone-400 hover:text-stone-800 hover:bg-stone-200/50 disabled:opacity-30 transition-all flex items-center gap-1"
        title="Generate nickname suggestions"
      >
        {generating ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Sparkles className="h-3 w-3" />
        )}
        Generate
      </button>
      {error && (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      )}
    </div>
  );
}
