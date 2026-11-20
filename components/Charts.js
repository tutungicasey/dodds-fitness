// Dependency-free SVG charts (server-rendered, no client JS needed).
export function BarChart({ data, height = 220, color = '#14b8a6', format = (v) => v, max }) {
  if (!data?.length) return <p className="muted">No data yet.</p>;
  const W = 640, H = height, pad = 28, bw = (W - pad * 2) / data.length;
  const m = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <svg viewBox={`0 0 ${W} ${H + 40}`} className="chart" role="img">
      <line x1={pad} y1={H} x2={W - pad} y2={H} stroke="#e5e7eb" />
      {data.map((d, i) => {
        const h = (d.value / m) * (H - 30);
        const x = pad + i * bw + bw * 0.15;
        return (
          <g key={i}>
            <rect x={x} y={H - h} width={bw * 0.7} height={h} rx="4" fill={d.color || color}><title>{`${d.label}: ${format(d.value)}`}</title></rect>
            <text x={x + bw * 0.35} y={H - h - 6} textAnchor="middle" fontSize="12" fill="#374151">{format(d.value)}</text>
            <text x={x + bw * 0.35} y={H + 16} textAnchor="middle" fontSize="12" fill="#6b7280">{d.label}</text>
            {d.sub && <text x={x + bw * 0.35} y={H + 31} textAnchor="middle" fontSize="10" fill="#9ca3af">{d.sub}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export function LineChart({ points, height = 200, color = '#14b8a6', unit = '' }) {
  const pts = (points || []).filter((p) => p.y != null);
  if (pts.length < 2) return <p className="muted">Add at least two entries to see a trend.</p>;
  const W = 640, H = height, pad = 40;
  const ys = pts.map((p) => p.y);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (hi === lo) { hi += 1; lo -= 1; }
  const span = hi - lo; lo -= span * 0.1; hi += span * 0.1;
  const X = (i) => pad + (i * (W - pad * 2)) / (pts.length - 1);
  const Y = (v) => H - 20 - ((v - lo) / (hi - lo)) * (H - 40);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H + 20}`} className="chart" role="img">
      {[0, 0.5, 1].map((f) => {
        const v = lo + (hi - lo) * f;
        return <g key={f}><line x1={pad} x2={W - pad} y1={Y(v)} y2={Y(v)} stroke="#f1f5f9" /><text x={4} y={Y(v) + 4} fontSize="11" fill="#9ca3af">{v.toFixed(1)}</text></g>;
      })}
      <path d={d} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={X(i)} cy={Y(p.y)} r="4" fill="#fff" stroke={color} strokeWidth="2"><title>{`${p.x}: ${p.y}${unit}`}</title></circle>
          {(i === 0 || i === pts.length - 1 || pts.length <= 8) && <text x={X(i)} y={H + 14} textAnchor="middle" fontSize="11" fill="#6b7280">{p.x}</text>}
        </g>
      ))}
    </svg>
  );
}

export function Heatmap({ rows, cols, values, format = (v) => v }) {
  const max = Math.max(1, ...values.flat());
  return (
    <div className="heatmap-wrap">
      <table className="heatmap">
        <thead><tr><th></th>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r}><th>{r}</th>{cols.map((c, j) => {
              const v = values[i][j];
              return <td key={c} style={{ background: v ? `rgba(20,184,166,${0.12 + 0.88 * (v / max)})` : '#f8fafc', color: v / max > 0.6 ? '#fff' : '#111827' }} title={`${r} ${c}: ${format(v)}`}>{v ? format(v) : ''}</td>;
            })}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
