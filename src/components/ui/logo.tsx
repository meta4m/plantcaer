/**
 * Plantcaer brand mark — a single leaf on a stem.
 * Stroke-based (inherits currentColor), crisp at any size.
 */

const LEAF_BODY =
  'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z';
const LEAF_VEIN = 'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12';

export function Logo({
  size = 22,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={LEAF_BODY} />
      <path d={LEAF_VEIN} />
    </svg>
  );
}
