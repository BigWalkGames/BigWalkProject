import './ProgressGraph.css';
import { useLayoutEffect, useRef, useState } from 'react';
import { useMatchHistory, type HistoryEntry } from '../../hooks/useMatchHistory';

const HEIGHT = 260;
const PAD = { top: 16, right: 64, bottom: 40, left: 64 };
const DAY = 86_400_000;

type Point = { t: number; wpm: number; acc: number };

const tickFormat = new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit' });

/** One point per day: the average WPM and accuracy of that day's matches. */
function dailyAverages(entries: HistoryEntry[]): Point[] {
  const days = new Map<number, { wpm: number; acc: number; n: number }>();
  for (const e of entries) {
    const d = new Date(e.id); // id is the match timestamp
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const sum = days.get(day) ?? { wpm: 0, acc: 0, n: 0 };
    sum.wpm += e.wpm;
    sum.acc += e.accuracy;
    sum.n += 1;
    days.set(day, sum);
  }
  return [...days.entries()]
    .map(([t, s]) => ({ t, wpm: s.wpm / s.n, acc: s.acc / s.n }))
    .sort((a, b) => a.t - b.t);
}

export function ProgressGraph() {
  const { entries, status } = useMatchHistory('all');
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

  const points = dailyAverages(entries);
  const hasData = !status && points.length > 0;

  let chart: React.ReactNode = null;
  if (hasData && width > 0) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const t0 = points[0].t;
    const t1 = Math.max(today, t0 + DAY);

    const wpmMax = Math.max(10, Math.ceil(Math.max(...points.map((p) => p.wpm)) / 10) * 10);
    const accMin = Math.max(0, Math.floor((Math.min(...points.map((p) => p.acc)) - 5) / 10) * 10);

    const plotW = Math.max(0, width - PAD.left - PAD.right);
    const plotH = HEIGHT - PAD.top - PAD.bottom;
    const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * plotW;
    const yWpm = (v: number) => PAD.top + plotH - (v / wpmMax) * plotH;
    const yAcc = (v: number) => PAD.top + plotH - ((v - accMin) / (100 - accMin)) * plotH;

    const line = (y: (v: number) => number, pick: (p: Point) => number) =>
      points.map((p) => `${x(p.t)},${y(pick(p))}`).join(' ');

    const gridSteps = [0, 0.25, 0.5, 0.75, 1];
    const tickCount = Math.max(2, Math.min(7, Math.floor(plotW / 110)));
    const ticks = Array.from({ length: tickCount }, (_, i) => t0 + ((t1 - t0) * i) / (tickCount - 1));

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
            {tickFormat.format(new Date(t))}
          </text>
        ))}

        <polyline className="progress-graph__line progress-graph__line--wpm" points={line(yWpm, (p) => p.wpm)} />
        <polyline className="progress-graph__line progress-graph__line--acc" points={line(yAcc, (p) => p.acc)} />
        {points.map((p) => (
          <g key={p.t}>
            <circle className="progress-graph__dot progress-graph__dot--wpm" cx={x(p.t)} cy={yWpm(p.wpm)} r={5}>
              <title>{`${tickFormat.format(new Date(p.t))}: ${Math.round(p.wpm)} WPM`}</title>
            </circle>
            <circle className="progress-graph__dot progress-graph__dot--acc" cx={x(p.t)} cy={yAcc(p.acc)} r={5}>
              <title>{`${tickFormat.format(new Date(p.t))}: ${Math.round(p.acc)}% accuracy`}</title>
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
      <div className="progress-graph__plot" ref={ref}>
        {hasData ? chart : <p className="progress-graph__status">{status ?? 'No matches yet.'}</p>}
      </div>
    </section>
  );
}
