import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { TrendingUp, Trophy, BarChart3, Database, ArrowUpRight } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { seedHorses, buildSeedResults, buildSeedValuations } from '../utils/seedData';
import { serverGetDBStats } from '../services/serverDB';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const fmtNum = (n: number) => new Intl.NumberFormat('es-AR').format(n);

export default function Dashboard() {
  const { horses, valuations, results, addHorse, addResults, addValuation } = useAppStore();
  const [dbStats, setDbStats] = useState<{ totalHorses: number; totalResults: number; totalEvents: number; totalSales: number } | null>(null);

  useEffect(() => {
    if (horses.length === 0) {
      seedHorses.forEach(addHorse);
      const sr = buildSeedResults();
      addResults(sr);
      buildSeedValuations(sr).forEach(addValuation);
    }
    serverGetDBStats().then(setDbStats).catch(() => {});
  }, []); // eslint-disable-line

  const latestValuations = valuations.slice(0, 5);
  const chartData = latestValuations.map((v) => ({
    name: v.horseName.split(' ')[0],
    min: v.valueMin, mid: v.valueMid, max: v.valueMax,
  })).reverse();
  const avgValue = valuations.length > 0
    ? Math.round(valuations.reduce((s, v) => s + v.valueMid, 0) / valuations.length)
    : 0;

  return (
    <div style={{ padding: '32px', background: '#F6F9FC', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: '#0A2540', letterSpacing: '-0.4px' }}>
          Panel de Control
        </h1>
        <p style={{ margin: 0, color: '#697386', fontSize: 14 }}>
          Plataforma de valoración ecuestre · {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16, marginBottom: 24 }}>
        <KpiCard icon={<Trophy size={16} />}    label="Caballos en BD"  value={fmtNum(dbStats?.totalHorses ?? horses.length)} accent="#635BFF" delta="+1821" />
        <KpiCard icon={<BarChart3 size={16} />}  label="Valoraciones"    value={fmtNum(valuations.length)}                     accent="#30B57C" />
        <KpiCard icon={<Database size={16} />}   label="Resultados en BD" value={fmtNum(dbStats?.totalResults ?? results.length)} accent="#3B82F6" />
        <KpiCard icon={<TrendingUp size={16} />} label="Valor promedio"  value={avgValue > 0 ? fmt(avgValue) : '—'}            accent="#F59E0B" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px', gap: 16, alignItems: 'start' }}>
        {/* Chart */}
        {chartData.length > 0 ? (
          <div style={{ background: '#FFFFFF', border: '1px solid #E3E8EF', borderRadius: 12, padding: '22px 22px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#0A2540' }}>Valoraciones recientes</h2>
              <span style={{ fontSize: 11, color: '#A3ACBA' }}>mín — mid — máx</span>
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradMid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#635BFF" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#635BFF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F4F8" />
                <XAxis dataKey="name" stroke="#CBD5E1" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: '#A3ACBA' }} />
                <YAxis stroke="#CBD5E1" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} tick={{ fill: '#A3ACBA' }} />
                <Tooltip
                  contentStyle={{ background: '#FFFFFF', border: '1px solid #E3E8EF', borderRadius: 8, color: '#0A2540', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  formatter={(v) => [fmt(Number(v)), '']}
                />
                <Area type="monotone" dataKey="max"  stroke="#30B57C"  strokeOpacity={0.5}  fill="none" strokeDasharray="4 3" strokeWidth={1.5} />
                <Area type="monotone" dataKey="mid"  stroke="#635BFF"  fill="url(#gradMid)" strokeWidth={2.5} />
                <Area type="monotone" dataKey="min"  stroke="#E5483B"  strokeOpacity={0.4}  fill="none" strokeDasharray="4 3" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ background: '#FFFFFF', border: '1px solid #E3E8EF', borderRadius: 12, padding: '48px 24px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.15 }}>♞</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#0A2540' }}>Sin valoraciones aún</div>
            <div style={{ fontSize: 13, color: '#A3ACBA', marginTop: 4 }}>
              Ve a <strong style={{ color: '#635BFF' }}>Valoración</strong> para generar la primera.
            </div>
          </div>
        )}

        {/* Side stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <StatBox label="Eventos" value={fmtNum(dbStats?.totalEvents ?? 0)} emoji="🏟️" />
          <StatBox label="Ventas" value={fmtNum(dbStats?.totalSales ?? 0)} emoji="🔨" />
          <StatBox label="Score prom." emoji="⭐" value={
            valuations.length > 0
              ? String(Math.round(valuations.reduce((s, v) => s + v.scores.overall, 0) / valuations.length))
              : '—'
          } />
        </div>
      </div>

      {/* Valuations table */}
      {latestValuations.length > 0 && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E3E8EF', borderRadius: 12, overflow: 'hidden', marginTop: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0A2540' }}>Últimas valoraciones</h2>
            <span style={{ fontSize: 11, color: '#A3ACBA' }}>{latestValuations.length} registros</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8FAFC' }}>
                {['Caballo', 'Fecha', 'Score', 'Mín', 'Máx', 'Riesgo'].map((h) => (
                  <th key={h} style={{ padding: '9px 16px', textAlign: 'left', fontSize: 10, color: '#A3ACBA', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid #E3E8EF' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {latestValuations.map((v) => (
                <tr key={v.id} className="ev-tr-hover" style={{ borderBottom: '1px solid #F0F4F8' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600, color: '#0A2540', fontSize: 13 }}>{v.horseName}</td>
                  <td style={{ padding: '12px 16px', color: '#A3ACBA', fontSize: 12 }}>{v.date.split('T')[0]}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: scoreColor(v.scores.overall) + '18', color: scoreColor(v.scores.overall), borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 700 }}>{v.scores.overall}</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#697386', fontSize: 13 }}>{fmt(v.valueMin)}</td>
                  <td style={{ padding: '12px 16px', color: '#0A2540', fontWeight: 700, fontSize: 13 }}>{fmt(v.valueMax)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: riskColor(v.risk) + '15', color: riskColor(v.risk), borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 600 }}>{v.risk}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, accent, delta }: {
  icon: React.ReactNode; label: string; value: string; accent: string; delta?: string;
}) {
  return (
    <div className="ev-card-hover" style={{ background: '#FFFFFF', border: '1px solid #E3E8EF', borderRadius: 12, padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', cursor: 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: accent + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent }}>
          {icon}
        </div>
        {delta && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 600, color: '#30B57C' }}>
            <ArrowUpRight size={12} />{delta}
          </div>
        )}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#0A2540', letterSpacing: '-0.5px', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#A3ACBA', marginTop: 6 }}>{label}</div>
    </div>
  );
}

function StatBox({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E3E8EF', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: 18, marginBottom: 6 }}>{emoji}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: '#0A2540', letterSpacing: '-0.3px' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#A3ACBA', marginTop: 3 }}>{label}</div>
    </div>
  );
}

function scoreColor(s: number) {
  if (s >= 70) return '#30B57C';
  if (s >= 45) return '#F59E0B';
  return '#E5483B';
}
function riskColor(r: 'low' | 'medium' | 'high') {
  return { low: '#30B57C', medium: '#F59E0B', high: '#E5483B' }[r];
}
