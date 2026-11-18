import './ProgressGraph.css';
import { useLayoutEffect, useRef, useState } from 'react';
import { useMatchHistory } from '../../hooks/useMatchHistory';
import { emptyMessage, type HistoryPeriod } from '../../hooks/historyPeriod';
import { graphAxis, graphPoints, type Outcome, type Point } from './graphAxis';

const DEFAULT_HEIGHT = 260;
const PAD = { top: 16, right: 64, bottom: 40, left: 64 };
const STRIP = 22;
const MIN_FILL_HEIGHT = 160; // extra room under the plot for the win / loss strip

const OUTCOME_LABEL: Record<Outcome, string> = { win: 'Win', loss: 'Loss', draw: 'Draw' };

const matchTime = new Intl.DateTimeFormat('en-US', {
  month: '2-digit',
  day: '2-digit',
  hour: 'numeric',
  minute: '2-digit',
});

type ProgressGraphProps = {
  period?: HistoryPeriod; // default: full history
  height?: number;         // plot height in px, default 260
  fill?: boolean;          // stretch to the height of the parent instead (overrides height)
};

/** Solo WPM and accuracy over time. With a period, it shows only that day, week, month or year. */
export function ProgressGraph({ period = 'all', height, fill }: ProgressGraphProps) {
  const { entries, status } = useMatchHistory(period);
  return <ProgressChart points={graphPoints(entries, period)} status={status} period={period} height={height} fill={fill} />;
}

type ProgressChartProps = {
  points: Point[];
  status: string | null;   // loading / error / empty message; null when there are points
  period?: HistoryPeriod;
  height?: number;
  fill?: boolean; // stretch to the parent's height; the parent must give the graph a height
};

/**
 * The WPM and accuracy graph for points passed in. When the points carry a
 * match outcome, a strip under the plot marks each match as a win, loss or draw.
 */
export function ProgressChart({ points, status, period = 'all', height = DEFAULT_HEIGHT, fill = false }: ProgressChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [plotHeight, setPlotHeight] = useState(0);
  const HEIGHT = fill ? Math.max(MIN_FILL_HEIGHT, plotHeight) : height;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      setWidth(el.clientWidth);
      setPlotHeight(el.clientHeight);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const hasData = !status && points.length > 0;
  const showResults = points.some((p) => p.outcome);

  let chart: React.ReactNode = null;
  if (hasData && width > 0 && (!fill || plotHeight > 0)) {
    const wpmMax = Math.max(10, Math.ceil(Math.max(...points.map((p) => p.wpm)) / 10) * 10);
    const accMin = Math.max(0, Math.floor((Math.min(...points.map((p) => p.acc)) - 5) / 10) * 10);

    const plotW = Math.max(0, width - PAD.left - PAD.right);
    const { t0, t1, ticks, tickLabel, pointLabel } = graphAxis(period, points, plotW);
    const plotH = HEIGHT - PAD.top - PAD.bottom - (showResults ? STRIP : 0);
    const plotBottom = PAD.top + plotH;
    const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * plotW;
    const yWpm = (v: number) => plotBottom - (v / wpmMax) * plotH;
    const yAcc = (v: number) => plotBottom - ((v - accMin) / (100 - accMin)) * plotH;

    const line = (y: (v: number) => number, pick: (p: Point) => number) =>
      points.map((p) => `${x(p.t)},${y(pick(p))}`).join(' ');

    // Single matches get their time in the hover text; daily averages just the date.
    const label = (p: Point) => (p.outcome ? matchTime.format(new Date(p.t)) : pointLabel(p.t));
    const result = (p: Point) => (p.outcome ? ` (${OUTCOME_LABEL[p.outcome]})` : '');

    const gridSteps = [0, 0.25, 0.5, 0.75, 1];

    chart = (
      <svg className="progress-graph__svg" width={width} height={HEIGHT} role="img"
        aria-label={showResults ? 'WPM, accuracy and match results over time' : 'WPM and accuracy over time'}>
        {gridSteps.map((s) => {
          const y = plotBottom - s * plotH;
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

        {showResults &&
          points.map((p, i) =>
            p.outcome ? (
              <rect key={`r${i}`} className={`progress-graph__result progress-graph__result--${p.outcome}`}
                x={x(p.t) - 4} y={plotBottom + 8} width={8} height={12}>
                <title>{`${label(p)}: ${Math.round(p.wpm)} WPM, ${Math.round(p.acc)}%, ${OUTCOME_LABEL[p.outcome]}`}</title>
              </rect>
            ) : null,
          )}

        <polyline className="progress-graph__line progress-graph__line--wpm" points={line(yWpm, (p) => p.wpm)} />
        <polyline className="progress-graph__line progress-graph__line--acc" points={line(yAcc, (p) => p.acc)} />
        {points.map((p, i) => (
          <g key={i}>
            <circle className="progress-graph__dot progress-graph__dot--wpm" cx={x(p.t)} cy={yWpm(p.wpm)} r={5}>
              <title>{`${label(p)}: ${Math.round(p.wpm)} WPM${result(p)}`}</title>
            </circle>
            <circle className="progress-graph__dot progress-graph__dot--acc" cx={x(p.t)} cy={yAcc(p.acc)} r={5}>
              <title>{`${label(p)}: ${Math.round(p.acc)}% accuracy${result(p)}`}</title>
            </circle>
          </g>
        ))}
      </svg>
    );
  }

  return (
    <section className={`progress-graph${fill ? ' progress-graph--fill' : ''}`} aria-label="Progress over time">
      <div className="progress-graph__legend">
        <span className="progress-graph__key progress-graph__key--wpm">WPM</span>
        <span className="progress-graph__key progress-graph__key--acc">Accuracy</span>
        {showResults && (
          <>
            <span className="progress-graph__key progress-graph__key--result progress-graph__key--win">Win</span>
            <span className="progress-graph__key progress-graph__key--result progress-graph__key--loss">Loss</span>
            <span className="progress-graph__key progress-graph__key--result progress-graph__key--draw">Draw</span>
          </>
        )}
      </div>
      <div className="progress-graph__plot" ref={ref} style={fill ? undefined : { minHeight: HEIGHT }}>
        {hasData ? chart : <p className="progress-graph__status">{status ?? emptyMessage(period)}</p>}
      </div>
    </section>
  );
}
