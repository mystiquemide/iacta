interface ChartPoint {
  at: number;
  price: number;
}

interface MarketChartProps {
  points: ChartPoint[];
  height?: number;
}

/**
 * Restrained line chart of YES-equivalent fill prices. Blue ramp fill,
 * hairline grid, Fira Code labels. Server-renderable.
 */
export function MarketChart({ points, height = 180 }: MarketChartProps) {
  const width = 640;
  const padL = 40;
  const padR = 10;
  const padT = 10;
  const padB = 22;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  if (points.length === 0) return null;

  const xs = points.map((p) => p.at);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const spanX = maxX - minX || 1;

  const x = (at: number) => padL + ((at - minX) / spanX) * plotW;
  const y = (price: number) => padT + (1 - price) * plotH;

  const linePoints = points
    .map((p) => `${x(p.at).toFixed(1)},${y(p.price).toFixed(1)}`)
    .join(" ");
  const areaPoints = `${padL},${padT + plotH} ${linePoints} ${padL + plotW},${padT + plotH}`;
  const gridPrices = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label="YES-equivalent fill price over the event window"
    >
      <defs>
        <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5c9fe9" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#5c9fe9" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {gridPrices.map((price) => (
        <g key={price}>
          <line
            x1={padL}
            x2={padL + plotW}
            y1={y(price)}
            y2={y(price)}
            stroke="#262626"
            strokeWidth="1"
          />
          <text
            x={padL - 8}
            y={y(price) + 3}
            textAnchor="end"
            fontSize="10"
            fill="#737370"
            fontFamily="var(--fira), monospace"
          >
            {price.toFixed(2)}
          </text>
        </g>
      ))}
      <polygon points={areaPoints} fill="url(#chart-fill)" />
      <polyline
        points={linePoints}
        fill="none"
        stroke="#5c9fe9"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <circle key={i} cx={x(p.at)} cy={y(p.price)} r="2.5" fill="#5c9fe9" />
      ))}
      <line
        x1={padL}
        x2={padL + plotW}
        y1={padT + plotH}
        y2={padT + plotH}
        stroke="#2b2b2b"
        strokeWidth="1"
      />
      <text x={padL} y={height - 6} fontSize="10" fill="#737370" fontFamily="var(--fira), monospace">
        {new Date(minX * 1000).toISOString().slice(11, 19)}
      </text>
      <text
        x={padL + plotW}
        y={height - 6}
        textAnchor="end"
        fontSize="10"
        fill="#737370"
        fontFamily="var(--fira), monospace"
      >
        {new Date(maxX * 1000).toISOString().slice(11, 19)}
      </text>
    </svg>
  );
}
