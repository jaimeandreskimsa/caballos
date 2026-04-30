interface ScoreRingProps {
  score: number;
  size?: number;
  label?: string;
  color?: string;
}

export function ScoreRing({ score, size = 80, label, color = '#B8963E' }: ScoreRingProps) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EBEBEB" strokeWidth={8} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={8}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
        <text
          x={size / 2} y={size / 2 + 5}
          textAnchor="middle" fill={color}
          fontSize={size / 5} fontWeight="700"
        >
          {score}
        </text>
      </svg>
      {label && <span style={{ fontSize: 11, color: '#888888', textAlign: 'center' }}>{label}</span>}
    </div>
  );
}
