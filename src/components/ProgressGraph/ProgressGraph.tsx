import './ProgressGraph.css';
import { useLayoutEffect, useRef, useState } from 'react';
import { useMatchHistory } from '../../hooks/useMatchHistory';
import { emptyMessage, type HistoryPeriod } from '../../hooks/historyPeriod';
import { graphAxis, graphPoints, type Point } from './graphAxis';

const DEFAULT_HEIGHT = 260;
const PAD = { top: 16, right: 64, bottom: 40, left: 64 };

type ProgressGraphProps = {
  period?: HistoryPeriod; // default: full history
  height?: number;         // plot height in px, default 260
};

/** WPM and accuracy over time. With a period, it shows only that day, week, month or year. */
export function ProgressGraph({ period = 'all', height: HEIGHT = DEFAULT_HEIGHT }: ProgressGraphProps) {
  const { entries, status } = useMatchHistory(period);
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = graphPoints(entries, period);
  const hasData = !status && points.length > 0;

  let chart: React.ReactNode = null;
  if (hasData && width > 0) {
    const wpmMax = Math.max(10, Math.ceil(Math.max(...points.map((p) => p.wpm)) / 10) * 10);
    const accMin = Math.max(0, Math.floor((Math.min(...points.map((p) => p.acc)) - 5) / 10) * 10);

    const plotW = Math.max(0, width - PAD.left - PAD.right);
    const { t0, t1, ticks, tickLabel, pointLabel } = graphAxis(period, points, plotW);
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * plotW;
    const yWpm = (v: number) => PAD.top + plotH - (v / wpmMax) * plotH;
    const yAcc = (v: number) => PAD.top + plotH - ((v - accMin) / (100 - accMin)) * plotH;

    const line = (y: (v: number) => number, pick: (p: Point) => number) =>
      points.map((p) => `${x(p.t)},${y(pick(p))}`).join(' ');

    const gridSteps = [0, 0.25, 0.5, 0.75, 1];

    chart = (
      <svg className="progress-graph__svg" width={width} height={HEIGHT} role="img"
        aria-label="WPM and accuracy over time">
        {gridSteps.map((s) => {
          const y = PAD.top + plotH - s * plotH;
          return (
            <g key={s}>
              <line className="progress-graph__grid" x1={PAD.left} x2={PAD.left + plotW} y1={y} y2={y} />
              <text className="progress-graph__tick progress-graph__tick--wpm" x={PAD.left - 10} y={y} textAnchor="end" dominantBaseline="middle">
                {Math.round(s * wpmMax)}
              </text>
              <text className="progress-graph__tick progress-graph__tick--acc" x={PAD.left + plotW + 10} y={y} textAnchor="start" dominantBaseline="middle">
                {Math.round(accMin + s * (100 - accMin))}%
              </text>
            </g>
          );
        })}

        {ticks.map((t) => (
          <text key={t} className="progress-graph__tick" x={x(t)} y={HEIGHT - 12} textAnchor="middle">
            {tickLabel(t)}
          </text>
        ))}

        <polyline className="progress-graph__line progress-graph__line--wpm" points={line(yWpm, (p) => p.wpm)} />
        <polyline className="progress-graph__line progress-graph__line--acc" points={line(yAcc, (p) => p.acc)} />
        {points.map((p) => (
          <g key={p.t}>
            <circle className="progress-graph__dot progress-graph__dot--wpm" cx={x(p.t)} cy={yWpm(p.wpm)} r={5}>
              <title>{`${pointLabel(p.t)}: ${Math.round(p.wpm)} WPM`}</title>
            </circle>
            <circle className="progress-graph__dot progress-graph__dot--acc" cx={x(p.t)} cy={yAcc(p.acc)} r={5}>
              <title>{`${pointLabel(p.t)}: ${Math.round(p.acc)}% accuracy`}</title>
            </circle>
          </g>
        ))}
      </svg>
    );
  }

  return (
    <section className="progress-graph" aria-label="Progress over time">
      <div className="progress-graph__legend">
        <span className="progress-graph__key progress-graph__key--wpm">WPM</span>
        <span className="progress-graph__key progress-graph__key--acc">Accuracy</span>
      </div>
      <div className="progress-graph__plot" ref={ref} style={{ minHeight: HEIGHT }}>
        {hasData ? chart : <p className="progress-graph__status">{status ?? emptyMessage(period)}</p>}
      </div>
    </section>
  );
}
