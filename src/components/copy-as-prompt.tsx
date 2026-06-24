'use client';

import { useState } from 'react';
import { Clipboard, ClipboardCheck } from 'lucide-react';
import { formatPlantSummary } from '@/lib/ai/prompts';
import type { Plant, CareTask } from '@/lib/types';

interface CopyAsPromptProps {
  plant: Plant;
  careTasks: CareTask[];
  /** Compact icon-only mode for mobile */
  compact?: boolean;
}

export function CopyAsPrompt({ plant, careTasks, compact = false }: CopyAsPromptProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const summary = formatPlantSummary({
      common_name: plant.common_name,
      scientific_name: plant.scientific_name,
      location: plant.location,
      light_requirement: plant.light_requirement,
      min_temp: plant.min_temp,
      max_temp: plant.max_temp,
      humidity_min: plant.humidity_min,
      notes: plant.notes,
      care_tasks: careTasks.map((t) => ({
        task_type: t.task_type,
        frequency_days: t.frequency_days,
        amount: t.amount,
        notes: t.notes,
      })),
    });

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = summary;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-xl p-2 text-white/40 hover:text-white hover:bg-white/10 transition-all active:scale-[0.98]"
        title="Copy as AI prompt"
      >
        {copied ? (
          <ClipboardCheck className="h-4 w-4 text-emerald-400" />
        ) : (
          <Clipboard className="h-4 w-4" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="glass-card rounded-xl px-4 py-2 text-sm text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2 active:scale-[0.98]"
    >
      {copied ? (
        <>
          <ClipboardCheck className="h-4 w-4 text-emerald-400" />
          <span className="text-emerald-400">Copied!</span>
        </>
      ) : (
        <>
          <Clipboard className="h-4 w-4" />
          Copy as Prompt
        </>
      )}
    </button>
  );
}
