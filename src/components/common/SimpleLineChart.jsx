import React from 'react';

const formatNumber = (value) => {
  if (!Number.isFinite(value)) return '--';
  if (Math.abs(value) >= 1000) return value.toFixed(0);
  if (Math.abs(value) >= 100) return value.toFixed(1);
  if (Math.abs(value) >= 1) return value.toFixed(2);
  return value.toFixed(3);
};

const useSeries = (data, { color, label }) => {
  const safeData = Array.isArray(data) ? data.filter(Number.isFinite) : [];
  const stats = {
    min: safeData.length ? Math.min(...safeData) : 0,
    max: safeData.length ? Math.max(...safeData) : 0,
    current: safeData.length ? safeData[safeData.length - 1] : 0,
  };
  return {
    color,
    label,
    data: safeData,
    stats,
  };
};

export const SimpleLineChart = ({
  data = [],
  data2 = [],
  color = '#34d399',
  color2 = '#f87171',
  label = '数值',
  label2 = '对比数值',
  height = 128,
}) => {
  const primary = useSeries(data, { color, label });
  const secondary = useSeries(data2, { color: color2, label: label2 });

  const hasPrimary = primary.data.length > 0;
  const hasSecondary = secondary.data.length > 0;
  if (!hasPrimary && !hasSecondary) {
    return (
      <div className="flex h-32 flex-col items-center justify-center text-xs text-gray-500">
        <p>暂无历史数据</p>
      </div>
    );
  }

  const width = 320;
  const padding = 10;
  const allValues = [...primary.data, ...secondary.data];
  const yMinRaw = Math.min(...allValues);
  const yMaxRaw = Math.max(...allValues);
  const yPadding = (yMaxRaw - yMinRaw) * 0.1 || 1;
  const yMin = yMinRaw - yPadding;
  const yMax = yMaxRaw + yPadding;
  const range = Math.max(yMax - yMin, 1);
  const totalPoints = Math.max(primary.data.length, secondary.data.length, 2);
  const xStep = totalPoints > 1 ? (width - padding * 2) / (totalPoints - 1) : 0;

  const buildPoints = (seriesData) => {
    if (!seriesData.length) return '';
    const offset = totalPoints - seriesData.length;
    return seriesData
      .map((value, index) => {
        const x = padding + (offset + index) * xStep;
        const normalized = (value - yMin) / range;
        const y = height - padding - normalized * (height - padding * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const primaryPoints = buildPoints(primary.data);
  const secondaryPoints = buildPoints(secondary.data);

  const SeriesLegend = ({ color: c, text }) => (
    <div className="flex items-center gap-2 text-xs text-gray-400">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />
      <span>{text}</span>
    </div>
  );

  const StatsRow = ({ title, stats }) => (
    <div className="text-[11px] text-gray-400">
      <p className="text-xs text-gray-300">{title}</p>
      <div className="mt-1 flex gap-4 font-mono">
        <span>Max {formatNumber(stats.max)}</span>
        <span>Min {formatNumber(stats.min)}</span>
        <span>Now {formatNumber(stats.current)}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4">
        {hasPrimary && <SeriesLegend color={primary.color} text={primary.label} />}
        {hasSecondary && <SeriesLegend color={secondary.color} text={secondary.label} />}
      </div>
      <div className="relative h-32 w-full overflow-hidden rounded-xl border border-gray-800/60 bg-gray-950/50">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-full w-full">
          {[0.25, 0.5, 0.75].map((ratio) => {
            const y = height - padding - ratio * (height - padding * 2);
            return (
              <line
                key={ratio}
                x1={padding}
                x2={width - padding}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="1"
              />
            );
          })}
          {hasSecondary && (
            <polyline
              points={secondaryPoints}
              stroke={secondary.color}
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.7"
            />
          )}
          {hasPrimary && (
            <polyline
              points={primaryPoints}
              stroke={primary.color}
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </div>
      {hasPrimary && <StatsRow title={primary.label} stats={primary.stats} />}
      {hasSecondary && <StatsRow title={secondary.label} stats={secondary.stats} />}
    </div>
  );
};
