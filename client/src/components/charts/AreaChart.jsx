import { useMemo, useState } from 'react';
import { useElementWidth } from '../../hooks/useElementWidth.js';
import { ChartLegend } from './ChartLegend.jsx';
import { SERIES } from './series.js';
import styles from './AreaChart.module.scss';

const PADDING = { top: 16, right: 56, bottom: 26, left: 44 };
const HEIGHT = 260;
const TICK_COUNT = 4;
/** Minimum vertical gap between two end labels before one is dropped. */
const LABEL_MIN_GAP = 15;

/** Rounds a maximum up to a clean axis bound: 1, 2 or 5 x a power of ten. */
function niceCeil(value) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;
  return step * magnitude;
}

function formatDay(iso) {
  const [, month, day] = iso.split('-');
  return `${Number(day)}/${Number(month)}`;
}

/**
 * Daily engagement over time, one line per funnel stage.
 *
 * All three series are counts of the same thing on the same scale, so they
 * share one y-axis. (A second axis would let the shape of two series be
 * rescaled independently, which invents correlations that are not in the data.)
 */
export function AreaChart({ data, title, subtitle, partialLast = true }) {
  const [containerRef, width] = useElementWidth();
  const [hoverIndex, setHoverIndex] = useState(null);

  const geometry = useMemo(() => {
    if (!width || !data.length) return null;

    const innerWidth = Math.max(width - PADDING.left - PADDING.right, 10);
    const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;

    const peak = data.reduce(
      (max, row) => Math.max(max, row.views, row.clicks, row.conversions),
      0
    );
    const yMax = niceCeil(peak || 1);

    // A single point has no span to divide, so it is pinned to the left edge.
    const stepX = data.length > 1 ? innerWidth / (data.length - 1) : 0;
    const x = (index) => PADDING.left + index * stepX;
    const y = (value) => PADDING.top + innerHeight * (1 - value / yMax);

    const paths = SERIES.map((series) => {
      const points = data.map((row, i) => [x(i), y(row[series.key])]);
      const toPath = (pts) => pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px} ${py}`).join(' ');

      // The last day is still in progress, so its count is not comparable
      // with the completed days beside it. Splitting the final segment lets
      // it be drawn dashed rather than presented as a real drop-off.
      const solidPoints = partialLast && points.length > 1 ? points.slice(0, -1) : points;
      const tailPoints = partialLast && points.length > 1 ? points.slice(-2) : [];

      const baseline = PADDING.top + innerHeight;
      const areaPoints = solidPoints;
      const area = `${toPath(areaPoints)} L${areaPoints.at(-1)[0]} ${baseline} L${areaPoints[0][0]} ${baseline} Z`;

      return {
        ...series,
        line: toPath(solidPoints),
        tail: tailPoints.length ? toPath(tailPoints) : null,
        area,
        endPoint: points.at(-1),
        endValue: data.at(-1)[series.key],
      };
    });

    // End labels are placed top-down and skipped where they would collide,
    // rather than nudged apart - a nudged label detaches from its line.
    let lastLabelY = -Infinity;
    const endLabels = [...paths]
      .sort((a, b) => a.endPoint[1] - b.endPoint[1])
      .filter((series) => {
        if (series.endPoint[1] - lastLabelY < LABEL_MIN_GAP) return false;
        lastLabelY = series.endPoint[1];
        return true;
      })
      .map((series) => series.key);

    const ticks = Array.from({ length: TICK_COUNT + 1 }, (_, i) => {
      const value = (yMax / TICK_COUNT) * i;
      return { value, y: y(value) };
    });

    return { innerWidth, innerHeight, x, y, yMax, paths, ticks, endLabels, stepX };
  }, [data, width, partialLast]);

  const hoveredRow = hoverIndex === null ? null : data[hoverIndex];

  function handlePointerMove(event) {
    if (!geometry) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const offsetX = event.clientX - bounds.left - PADDING.left;
    const index = geometry.stepX
      ? Math.round(offsetX / geometry.stepX)
      : 0;
    setHoverIndex(Math.min(Math.max(index, 0), data.length - 1));
  }

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.header}>
        <div>
          <h3 className={styles.title}>{title}</h3>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          {partialLast && data.length > 1 && (
            <p className={styles.note}>Dashed segment: today is still in progress</p>
          )}
        </div>
        <ChartLegend series={SERIES} />
      </figcaption>

      <div className={styles.plot} ref={containerRef}>
        {geometry && (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`${title}. ${data.length} days of engagement data.`}
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHoverIndex(null)}
          >
            {/* Gridlines: hairline, solid, one step off the surface. */}
            {geometry.ticks.map((tick) => (
              <g key={tick.value}>
                <line
                  x1={PADDING.left}
                  x2={width - PADDING.right}
                  y1={tick.y}
                  y2={tick.y}
                  className={styles.grid}
                />
                <text x={PADDING.left - 8} y={tick.y + 4} className={styles.axisLabel} textAnchor="end">
                  {Math.round(tick.value).toLocaleString()}
                </text>
              </g>
            ))}

            {geometry.paths.map((series) => (
              <path key={`area-${series.key}`} d={series.area} fill={series.color} className={styles.area} />
            ))}

            {geometry.paths.map((series) => (
              <path
                key={`line-${series.key}`}
                d={series.line}
                stroke={series.color}
                className={styles.line}
              />
            ))}

            {/* Dashed = this day is not over yet, so its count is not
                comparable with the completed days beside it. A dashed stroke
                here is a data qualifier; the gridlines stay solid. */}
            {geometry.paths.map((series) =>
              series.tail ? (
                <path
                  key={`tail-${series.key}`}
                  d={series.tail}
                  stroke={series.color}
                  className={styles.tail}
                />
              ) : null
            )}

            {/* Crosshair sits above the fills but below the markers. */}
            {hoverIndex !== null && (
              <line
                x1={geometry.x(hoverIndex)}
                x2={geometry.x(hoverIndex)}
                y1={PADDING.top}
                y2={PADDING.top + geometry.innerHeight}
                className={styles.crosshair}
              />
            )}

            {geometry.paths.map((series) => {
              const [cx, cy] = hoverIndex === null
                ? series.endPoint
                : [geometry.x(hoverIndex), geometry.y(data[hoverIndex][series.key])];

              return (
                <circle
                  key={`dot-${series.key}`}
                  cx={cx}
                  cy={cy}
                  r="4"
                  fill={series.color}
                  className={styles.marker}
                />
              );
            })}

            {/* Direct end-labels, only where they do not collide. */}
            {hoverIndex === null &&
              geometry.paths
                .filter((series) => geometry.endLabels.includes(series.key))
                .map((series) => (
                  <text
                    key={`label-${series.key}`}
                    x={series.endPoint[0] + 10}
                    y={series.endPoint[1] + 4}
                    className={styles.endLabel}
                  >
                    {series.endValue}
                  </text>
                ))}

            {/* X axis: first, middle and last day only - one label per day
                would collide at this width. */}
            {[0, Math.floor((data.length - 1) / 2), data.length - 1].map((index) => (
              <text
                key={`x-${index}`}
                x={geometry.x(index)}
                y={HEIGHT - 6}
                className={styles.axisLabel}
                textAnchor={index === 0 ? 'start' : index === data.length - 1 ? 'end' : 'middle'}
              >
                {formatDay(data[index].date)}
              </text>
            ))}
          </svg>
        )}

        {hoveredRow && geometry && (
          <div
            className={styles.tooltip}
            style={{
              // Flips to the left of the crosshair past the midpoint so the
              // tooltip never runs off the right edge.
              left: geometry.x(hoverIndex),
              transform:
                geometry.x(hoverIndex) > width / 2
                  ? 'translate(calc(-100% - 12px), 0)'
                  : 'translate(12px, 0)',
            }}
            role="status"
          >
            <p className={styles.tooltipDate}>{hoveredRow.date}</p>
            {SERIES.map((series) => (
              <p key={series.key} className={styles.tooltipRow}>
                <span className={styles.tooltipKey} style={{ background: series.color }} />
                <span className={styles.tooltipValue}>{hoveredRow[series.key]}</span>
                <span className={styles.tooltipLabel}>{series.label}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}
