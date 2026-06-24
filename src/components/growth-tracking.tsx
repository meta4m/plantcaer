'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import type { GrowthRecord } from '@/lib/types';
import { Loader2, TrendingUp, Ruler, Leaf, Plus } from 'lucide-react';

interface GrowthTrackingProps {
  plantId: string;
  records: GrowthRecord[];
}

export function GrowthTracking({ plantId, records }: GrowthTrackingProps) {
  const router = useRouter();
  const supabase = createClient();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [height, setHeight] = useState('');
  const [leafCount, setLeafCount] = useState('');
  const [recordedAt, setRecordedAt] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const sortedRecords = [...records].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!height && !leafCount) return;

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('growth_records').insert({
        plant_id: plantId,
        recorded_at: recordedAt,
        height_cm: height ? parseFloat(height) : null,
        leaf_count: leafCount ? parseInt(leafCount, 10) : null,
        notes: notes.trim() || null,
      });

      // Reset form
      setHeight('');
      setLeafCount('');
      setNotes('');
      setRecordedAt(new Date().toISOString().split('T')[0]);
      setShowForm(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-400" />
          Growth Tracking
          {records.length > 0 && (
            <span className="text-sm font-normal text-white/40 ml-1">
              ({records.length} record{records.length !== 1 ? 's' : ''})
            </span>
          )}
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="glass-card rounded-xl px-3 py-1.5 text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center gap-1.5"
        >
          {showForm ? (
            'Cancel'
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" />
              Record Growth
            </>
          )}
        </button>
      </div>

      {/* Add Growth Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-4 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1 flex items-center gap-1">
                <Ruler className="h-3 w-3" />
                Height (cm)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="e.g. 45"
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1 flex items-center gap-1">
                <Leaf className="h-3 w-3" />
                Leaf Count
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={leafCount}
                onChange={(e) => setLeafCount(e.target.value)}
                placeholder="e.g. 12"
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1">Date</label>
            <input
              type="date"
              value={recordedAt}
              onChange={(e) => setRecordedAt(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-white/50 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Looking healthy, new growth..."
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/25 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all"
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={(!height && !leafCount) || saving}
              className="rounded-lg bg-emerald-500/20 px-4 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-50 transition-all flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Measurement'
              )}
            </button>
          </div>
        </form>
      )}

      {records.length === 0 ? (
        <div className="glass-card rounded-2xl p-6 text-center">
          <TrendingUp className="h-8 w-8 mx-auto text-white/20 mb-2" />
          <p className="text-sm text-white/30">No growth records yet</p>
          <p className="text-xs text-white/20 mt-1">
            Track height, leaf count, and progress over time
          </p>
        </div>
      ) : (
        <>
          {/* Chart */}
          <div className="glass-card rounded-2xl p-4 mb-4">
            <GrowthChart records={sortedRecords} />
          </div>

          {/* Timeline */}
          <div className="space-y-1.5">
            {[...records]
              .sort((a, b) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime())
              .map((record, i, arr) => {
                const prevHeight = i < arr.length - 1 ? arr[i + 1]?.height_cm : null;
                const prevLeafCount = i < arr.length - 1 ? arr[i + 1]?.leaf_count : null;
                const heightDiff = record.height_cm && prevHeight ? record.height_cm - prevHeight : null;
                const leafDiff = record.leaf_count && prevLeafCount ? record.leaf_count - prevLeafCount : null;

                return (
                  <div
                    key={record.id}
                    className="glass-card rounded-xl p-3 flex items-start gap-3"
                  >
                    {/* Timeline dot */}
                    <div className="mt-1.5 shrink-0">
                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/50 ring-2 ring-emerald-500/20" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-white/70 font-medium">
                          {new Date(record.recorded_at).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                        {record.height_cm !== null && (
                          <span className="text-xs text-white/50 flex items-center gap-1">
                            <Ruler className="h-3 w-3 text-emerald-400/60" />
                            <span className="text-white/80 font-medium">{record.height_cm} cm</span>
                            {heightDiff !== null && heightDiff > 0 && (
                              <span className="text-emerald-400/60">+{heightDiff.toFixed(1)}</span>
                            )}
                            {heightDiff !== null && heightDiff < 0 && (
                              <span className="text-red-400/60">{heightDiff.toFixed(1)}</span>
                            )}
                          </span>
                        )}
                        {record.leaf_count !== null && (
                          <span className="text-xs text-white/50 flex items-center gap-1">
                            <Leaf className="h-3 w-3 text-emerald-400/60" />
                            <span className="text-white/80 font-medium">{record.leaf_count} leaves</span>
                            {leafDiff !== null && leafDiff > 0 && (
                              <span className="text-emerald-400/60">+{leafDiff}</span>
                            )}
                            {leafDiff !== null && leafDiff < 0 && (
                              <span className="text-red-400/60">{leafDiff}</span>
                            )}
                          </span>
                        )}
                      </div>

                      {record.notes && (
                        <p className="text-xs text-white/30 mt-1 italic">&ldquo;{record.notes}&rdquo;</p>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
}

/** Simple inline SVG chart for growth records */
function GrowthChart({ records }: { records: GrowthRecord[] }) {
  const hasHeight = records.some((r) => r.height_cm !== null);
  const hasLeaves = records.some((r) => r.leaf_count !== null);

  if (!hasHeight && !hasLeaves) return null;

  // Chart dimensions
  const WIDTH = 600;
  const HEIGHT = 200;
  const PADDING = { top: 20, right: 20, bottom: 30, left: 50 };
  const CHART_W = WIDTH - PADDING.left - PADDING.right;
  const CHART_H = HEIGHT - PADDING.top - PADDING.bottom;

  // Scale helpers
  const dates = records.map((r) => new Date(r.recorded_at).getTime());
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];
  const dateRange = Math.max(maxDate - minDate, 1);

  const scaleX = (date: Date) =>
    PADDING.left + (date.getTime() - minDate) / dateRange * CHART_W;

  // Height scale
  const heightValues = records.map((r) => r.height_cm ?? 0);
  const maxHeight = Math.max(...heightValues, 1);
  const scaleHeight = (val: number) =>
    PADDING.top + CHART_H - (val / maxHeight) * CHART_H;

  // Leaf count scale
  const leafValues = records.map((r) => r.leaf_count ?? 0);
  const maxLeaves = Math.max(...leafValues, 1);
  const scaleLeaves = (val: number) =>
    PADDING.top + CHART_H - (val / maxLeaves) * CHART_H;

  // Build path strings
  const heightPath = hasHeight
    ? records
        .map((r, i) => {
          const x = scaleX(new Date(r.recorded_at));
          const y = scaleHeight(r.height_cm ?? 0);
          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        })
        .join(' ')
    : '';

  const leafPath = hasLeaves
    ? records
        .map((r, i) => {
          const x = scaleX(new Date(r.recorded_at));
          const y = scaleLeaves(r.leaf_count ?? 0);
          return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        })
        .join(' ')
    : '';

  // Y-axis ticks
  const heightTicks = hasHeight
    ? Array.from({ length: 5 }, (_, i) => Math.round((maxHeight / 4) * i))
    : [];

  const leafTicks = hasLeaves
    ? Array.from({ length: 5 }, (_, i) => Math.round((maxLeaves / 4) * i))
    : [];

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full max-h-52"
        role="img"
        aria-label="Growth chart"
      >
        {/* Grid lines */}
        {heightTicks.map((tick, i) => {
          const y = scaleHeight(tick || 0.1);
          return (
            <g key={`grid-h-${i}`}>
              <line
                x1={PADDING.left}
                y1={y}
                x2={WIDTH - PADDING.right}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeDasharray="4 4"
              />
              <text x={PADDING.left - 8} y={y + 4} textAnchor="end" className="fill-white/30" fontSize="10">
                {tick}
              </text>
            </g>
          );
        })}

        {/* Height line */}
        {hasHeight && (
          <>
            {/* Area fill */}
            <path
              d={`${heightPath} L ${scaleX(new Date(records[records.length - 1].recorded_at))} ${PADDING.top + CHART_H} L ${scaleX(new Date(records[0].recorded_at))} ${PADDING.top + CHART_H} Z`}
              fill="url(#heightGradient)"
              opacity={0.15}
            />
            <path
              d={heightPath}
              fill="none"
              stroke="#34d399"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Height dots */}
            {records.map((r, i) => {
              if (r.height_cm === null) return null;
              const cx = scaleX(new Date(r.recorded_at));
              const cy = scaleHeight(r.height_cm);
              return (
                <circle
                  key={`h-${i}`}
                  cx={cx}
                  cy={cy}
                  r="3"
                  fill="#34d399"
                  stroke="#0a0a0a"
                  strokeWidth="1.5"
                />
              );
            })}
          </>
        )}

        {/* Leaf count line */}
        {hasLeaves && records.length > 1 && (
          <>
            <path
              d={leafPath}
              fill="none"
              stroke="#818cf8"
              strokeWidth="2"
              strokeDasharray="6 3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {records.map((r, i) => {
              if (r.leaf_count === null) return null;
              const cx = scaleX(new Date(r.recorded_at));
              const cy = scaleLeaves(r.leaf_count);
              return (
                <circle
                  key={`l-${i}`}
                  cx={cx}
                  cy={cy}
                  r="3"
                  fill="#818cf8"
                  stroke="#0a0a0a"
                  strokeWidth="1.5"
                />
              );
            })}
          </>
        )}

        {/* X-axis labels (show a few dates) */}
        {records.length > 0 &&
          [0, Math.floor(records.length / 2), records.length - 1].map((idx) => {
            const date = new Date(records[idx].recorded_at);
            const x = scaleX(date);
            return (
              <text
                key={`x-${idx}`}
                x={x}
                y={HEIGHT - 5}
                textAnchor="middle"
                className="fill-white/30"
                fontSize="10"
              >
                {date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </text>
            );
          })}

        {/* Legend */}
        <g transform={`translate(${WIDTH - 110}, 8)`}>
          {hasHeight && (
            <>
              <line x1="0" y1="0" x2="12" y2="0" stroke="#34d399" strokeWidth="2" />
              <text x="16" y="4" className="fill-white/50" fontSize="10">Height</text>
            </>
          )}
          {hasLeaves && records.length > 1 && (
            <>
              <line x1="0" y1="14" x2="12" y2="14" stroke="#818cf8" strokeWidth="2" strokeDasharray="4 2" />
              <text x="16" y="18" className="fill-white/50" fontSize="10">Leaves</text>
            </>
          )}
          {records.length === 1 && (
            <text x="0" y="0" className="fill-white/30" fontSize="10">
              Add more records to see a trend
            </text>
          )}
        </g>

        {/* Gradients */}
        <defs>
          <linearGradient id="heightGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="1" />
            <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
