import styles from './Sparkline.module.scss';

const WIDTH = 96;
const HEIGHT = 28;
const PAD = 3;

/**
 * A 14-point trend line for a stat tile.
 *
 * Deliberately axis-less and label-less: a sparkline answers "which way is
 * this going", not "what is the value" — the tile's own number carries that.
 * The end point is marked so the reader knows which end is now.
 */
export function Sparkline({ values, color, label }) {
  if (!values || values.length < 2) return null;

  const max = Math.max(...values, 1);
  const stepX = (WIDTH - PAD * 2) / (values.length - 1);

  const points = values.map((value, i) => [
    PAD + i * stepX,
    // Flat-lines sit on the baseline rather than mid-height, so a dead metric
    // reads as dead at a glance.
    PAD + (HEIGHT - PAD * 2) * (1 - value / max),
  ]);

  const line = points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
  const area = `${line} L${points.at(-1)[0]} ${HEIGHT - PAD} L${points[0][0]} ${HEIGHT - PAD} Z`;
  const [endX, endY] = points.at(-1);

  return (
    <svg
      className={styles.spark}
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={label}
    >
      <path d={area} fill={color} className={styles.area} />
      <path d={line} stroke={color} className={styles.line} />
      <circle cx={endX} cy={endY} r="2.5" fill={color} className={styles.end} />
    </svg>
  );
}
