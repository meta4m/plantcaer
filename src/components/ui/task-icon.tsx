import { TASK_TYPE_ICON_META } from '@/lib/icons';
import type { TaskType } from '@/lib/types';

type TaskIconProps = {
  type: TaskType;
  /** Pixel size passed to the Lucide icon (width & height). */
  size?: number;
  className?: string;
};

/**
 * Renders the Lucide icon for a care task type in its semantic color.
 * Replaces the emoji map (TASK_TYPE_ICONS from types.ts) in UI contexts.
 */
export function TaskIcon({ type, size = 20, className }: TaskIconProps) {
  const meta = TASK_TYPE_ICON_META[type];
  if (!meta) return null;

  const Icon = meta.icon;
  return (
    <Icon
      size={size}
      className={className}
      style={{ color: meta.color }}
      aria-hidden="true"
    />
  );
}
