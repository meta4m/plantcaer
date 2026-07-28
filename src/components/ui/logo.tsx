/**
 * Plantcaer brand mark — two leaves on one stem.
 * Front leaf renders fully; the back leaf rotates left around the shared
 * stem and is masked by the front leaf for natural overlap.
 * Stroke-based (inherits currentColor), crisp at any size.
 *
 * Tweaking: BACK_ROTATE controls spread and BACK_SCALE controls its size.
 */

const LEAF_BODY =
  'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z';
const LEAF_VEIN = 'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12';

const BACK_ROTATE = -42;
const BACK_SCALE = 0.75;
const STEM_X = 2;
const STEM_Y = 21;

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
      <defs>
        <mask id="plantcaer-logo-back-mask">
          <rect x="-4" y="-4" width="32" height="32" fill="white" />
          <path
            d={LEAF_BODY}
            fill="black"
            stroke="black"
            strokeWidth={3}
          />
        </mask>
      </defs>

      {/* Back leaf — fully visible except where the front leaf covers it */}
      <g mask="url(#plantcaer-logo-back-mask)" opacity={0.8}>
        <g
          transform={`translate(${STEM_X} ${STEM_Y}) rotate(${BACK_ROTATE}) scale(${BACK_SCALE}) translate(${-STEM_X} ${-STEM_Y})`}
        >
          <path d={LEAF_BODY} />
          <path d={LEAF_VEIN} />
        </g>
      </g>

      {/* Front leaf */}
      <path d={LEAF_BODY} />
      <path d={LEAF_VEIN} />
    </svg>
  );
}
