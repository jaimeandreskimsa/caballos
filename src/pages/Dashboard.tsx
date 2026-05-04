import { useEffect, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { TrendingUp, Trophy, BarChart3, Database, Sparkles } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { seedHorses, buildSeedResults, buildSeedValuations } from '../utils/seedData';
import { serverGetDBStats } from '../services/serverDB';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const fmtNum = (n: number) =>
  new Intl.NumberFormat('es-AR').format(n);

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

  const chartData = latestValuations
    .map((v) => ({
      name: v.horseName.split(' ')[0],
      min: v.valueMin,
      mid: v.valueMid,
      max: v.valueMax,
    }))
    .reverse();

  const avgValue =
    valuations.length > 0
      ? Math.round(valuations.reduce((s, v) => s + v.valueMid, 0) / valuations.length)
      : 0;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1140, background: 'var(--c-bg)', minHeight: '100vh' }}>

      {/* ── Hero header ── */}
      <div className="ev-gradient-card" style={{ marginBottom: 28 }}>
        <div style={{
          padding: '28px 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Sparkles size={13} color="#F0B429" />
              <span style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: '#F0B429',
              }}>
                EquiValue AI · Plataforma Ecuestre
              </span>
            </div>
            <h1 style={{
              margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: '-0.6px',
              background: 'linear-gradient(135deg, #F0EDE8 0%, #C9972C 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              Panel de Control 🏇
            </h1>
            <p style={{ margin: '8px 0 0', color: 'rgba(160,143,130,0.7)', fontSize: 13.5 }}>
              Valoración inteligente para caballos de salto ecuestre
            </p>
          </div>
          <div style={{
            fontSize: 72, lineHeight: 1, opacity: 0.08, userSelect: 'none',
            filter: 'drop-shadow(0 0 20px rgba(201,151,44,0.5))',
          }}>♞</div>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
        <KpiCard icon={<Trophy size={18} />}    label="Caballos en BD"   value={fmtNum(dbStats?.totalHorses ?? horses.length)} accent="#F0B429" emoji="🐎" />
        <KpiCard icon={<BarChart3 size={18} />}  label="Valoraciones"     value={fmtNum(valuations.length)}                     accent="#A78BFA" emoji="💰" />
        <KpiCard icon={<Database size={18} />}   label="Resultados en BD" value={fmtNum(dbStats?.totalResults ?? results.length)} accent="#60A5FA" emoji="📊" />
        <KpiCard icon={<TrendingUp size={18} />} label="Valor promedio"   value={avgValue > 0 ? fmt(avgValue) : '—'}             accent="#22C55E" emoji="📈" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'start' }}>
        {/* ── Chart ── */}
        {chartData.length > 0 ? (
          <div className="ev-gradient-card">
            <div style={{ padding: '24px 24px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#F0EDE8' }}>
                  Valoraciones recientes
                </h2>
                <span style={{ fontSize: 11, color: 'rgba(201,151,44,0.5)' }}>mín — mid — máx</span>
              </div>
              <ResponsiveContainer width="100%" height={210}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gradMid" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#C9972C" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#C9972C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="name" stroke="rgba(201,151,44,0.3)" fontSize={11} tickLine={false} axisLine={false} tick={{ fill: 'rgba(160,143,130,0.6)' }} />
                  <YAxis stroke="rgba(201,151,44,0.3)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} tick={{ fill: 'rgba(160,143,130,0.5)' }} />
                  <Tooltip
                    contentStyle={{ background: '#1A2030', border: '1px solid rgba(201,151,44,0.3)', borderRadius: 10, color: '#F0EDE8', fontSize: 12 }}
                    formatter={(v) => [fmt(Number(v)), '']}
                  />
                  <Area type="monotone" dataKey="max"  stroke="#22C55E"  strokeOpacity={0.5} fill="none" strokeDasharray="4 3" strokeWidth={1.5} />
                  <Area type="monotone" dataKey="mid"  stroke="#F0B429"  fill="url(#gradMid)" strokeWidth={2.5} />
                  <Area type="monotone" dataKey="min"  stroke="#EF4444"  strokeOpacity={0.4} fill="none" strokeDasharray="4 3" strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="ev-gradient-card">
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ fontSize: 52, marginBottom: 12, filter: 'drop-shadow(0 0 12px rgba(201,151,44,0.4))' }}>♞</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#F0EDE8' }}>Sin valoraciones aún</div>
              <div style={{ fontSize: 13, color: 'rgba(160,143,130,0.6)', marginTop: 6 }}>
                Ve a <strong style={{ color: '#F0B429' }}>Valoración</strong> para generar tu primera.
              </div>
            </div>
          </div>
        )}

        {/* ── Side stats ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 180 }}>
          <StatBox label="Eventos registrados" value={fmtNum(dbStats?.totalEvents ?? 0)} emoji="🏟️" />
          <StatBox label="Ventas registradas"  value={fmtNum(dbStats?.totalSales ?? 0)}  emoji="🔨" />
          <StatBox label="Score promedio" emoji="⭐" value={
            valuations.length > 0
              ? String(Math.round(valuations.reduce((s, v) => s + v.scores.overall, 0) / valuations.length))
              : '—'
          } />
        </div>
      </div>

      {/* ── Recent valuations table ── */}
      {latestValuations.length > 0 && (
        <div className="ev-gradient-card" style={{ marginTop: 20 }}>
          <div style={{ overflow: 'hidden', borderRadius: 16 }}>
            <div style={{
              padding: '16px 24px', borderBottom: '1px solid rgba(201,151,44,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(201,151,44,0.03)',
            }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#F0EDE8' }}>🏆 Últimas valoraciones</h2>
              <span style={{ fontSize: 11, color: 'rgba(201,151,44,0.5)' }}>{latestValuations.length} registros</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                  {['Caballo', 'Fecha', 'Score', 'Mín', 'Máx', 'Riesgo'].map((h) => (
                    <th key={h} style={{
                      padding: '10px 18px', textAlign: 'left',
                      fontSize: 10, color: 'rgba(201,151,44,0.5)', fontWeight: 700,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {latestValuations.map((v) => (
                  <tr key={v.id} className="ev-tr-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'default' }}>
                    <td style={{ padding: '13px 18px', fontWeight: 600, color: '#F0EDE8', fontSize: 13.5 }}>{v.horseName}</td>
                    <td style={{ padding: '13px 18px', color: 'rgba(160,143,130,0.6)', fontSize: 12 }}>{v.date.split('T')[0]}</td>
                    <td style={{ padding: '13px 18px' }}>
                      <span style={{
                        background: scoreColor(v.scores.overall) + '20',
                        color: scoreColor(v.scores.overall),
                        borderRadius: 6, padding: '3px 10px', fontSize: 12.5, fontWeight: 700,
                        border: `1px solid ${scoreColor(v.scores.overall)}30`,
                      }}>{v.scores.overall}</span>
                    </td>
                    <td style={{ padding: '13px 18px', color: 'rgba(201,151,44,0.7)', fontWeight: 600, fontSize: 13 }}>{fmt(v.valueMin)}</td>
                    <td style={{ padding: '13px 18px', color: '#F0B429', fontWeight: 700, fontSize: 13 }}>{fmt(v.valueMax)}</td>
                    <td style={{ padding: '13px 18px' }}>
                      <span style={{
                        background: riskColor(v.risk) + '18',
                        color: riskColor(v.risk),
                        border: `1px solid ${riskColor(v.risk)}30`,
                        borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 600,
                      }}>{v.risk}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, accent, emoji }: {
  icon: React.ReactNode; label: string; value: string; accent: string; emoji: string;
}) {
  return (
    <div className="ev-gradient-card ev-card-hover" style={{ cursor: 'default' }}>
      <div style={{ padding: '20px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: accent + '18',
            border: `1px solid ${accent}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: accent,
            boxShadow: `0 0 12px ${accent}20`,
          }}>{icon}</div>
          <span style={{ fontSize: 22, opacity: 0.6 }}>{emoji}</span>
        </div>
        <div style={{
          fontSize: 24, fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1,
          color: '#F0EDE8',
        }}>
          {value}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(160,143,130,0.6)', marginTop: 6, fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  );
}

function StatBox({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <div className="ev-gradient-card" style={{ cursor: 'default' }}>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 18, marginBottom: 4 }}>{emoji}</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#F0EDE8', letterSpacing: '-0.3px' }}>{value}</div>
        <div style={{ fontSize: 11, color: 'rgba(160,143,130,0.5)', marginTop: 3, fontWeight: 500 }}>{label}</div>
      </div>
    </div>
  );
}

function scoreColor(s: number) {
  if (s >= 70) return '#22C55E';
  if (s >= 45) return '#F59E0B';
  return '#EF4444';
}
function riskColor(r: 'low' | 'medium' | 'high') {
  return { low: '#22C55E', medium: '#F59E0B', high: '#EF4444' }[r];
}


      {/* ── Hero header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #FFFFFF 0%, #FAF6EE 100%)',
        border: '1px solid rgba(0,0,0,0.07)',
        borderRadius: 18,
        padding: '28px 32px',
        marginBottom: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Sparkles size={14} color="#A0731A" />
            <span style={{ fontSize: 11, fontWeight: 700, color: '#A0731A', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              EquiValue AI
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#1A1612', letterSpacing: '-0.6px', fontFamily: "'Playfair Display', serif" }}>
            Panel de Control
          </h1>
          <p style={{ margin: '6px 0 0', color: '#9A9189', fontSize: 13.5, fontWeight: 400 }}>
            Plataforma de valoración inteligente para caballos de salto ecuestre
          </p>
        </div>
        <div style={{
          fontSize: 52, lineHeight: 1, opacity: 0.25, userSelect: 'none',
          display: 'none',  // hide on mobile
        }}>♞</div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 28 }}>
        <KpiCard
          icon={<Trophy size={18} />}
          label="Caballos en BD"
          value={fmtNum(dbStats?.totalHorses ?? horses.length)}
          accent="#16A34A"
          isString
        />
        <KpiCard
          icon={<BarChart3 size={18} />}
          label="Valoraciones"
          value={fmtNum(valuations.length)}
          accent="#A0731A"
          isString
        />
        <KpiCard
          icon={<Database size={18} />}
          label="Resultados en BD"
          value={fmtNum(dbStats?.totalResults ?? results.length)}
          accent="#2563EB"
          isString
        />
        <KpiCard
          icon={<TrendingUp size={18} />}
          label="Valor promedio"
          value={avgValue > 0 ? fmt(avgValue) : '—'}
          accent="#7C3AED"
          isString
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'start' }}>
        {/* ── Chart ── */}
        {chartData.length > 0 ? (
          <div style={{
            background: '#FFFFFF',
            border: '1px solid rgba(0,0,0,0.07)',
            borderRadius: 16,
            padding: '24px 24px 16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A1612' }}>
                Valoraciones recientes
              </h2>
              <span style={{ fontSize: 11, color: '#C4BDB5' }}>Rango mín — mid — máx</span>
            </div>
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradMid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#A0731A" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#A0731A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="name" stroke="#C4BDB5" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#C4BDB5" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 10, color: '#1A1612', fontSize: 12 }}
                  formatter={(v) => [fmt(Number(v)), '']}
                />
                <Area type="monotone" dataKey="max" stroke="#16A34A" strokeOpacity={0.4} fill="none" strokeDasharray="4 3" strokeWidth={1.5} />
                <Area type="monotone" dataKey="mid" stroke="#A0731A" fill="url(#gradMid)" strokeWidth={2.5} />
                <Area type="monotone" dataKey="min" stroke="#DC2626" strokeOpacity={0.35} fill="none" strokeDasharray="4 3" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{
            background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)',
            borderRadius: 16, padding: '48px 24px',
            textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontSize: 44, marginBottom: 12, opacity: 0.3 }}>♞</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#5C5349' }}>Sin valoraciones aún</div>
            <div style={{ fontSize: 13, color: '#C4BDB5', marginTop: 6 }}>
              Ve a <strong style={{ color: '#A0731A' }}>Caballos</strong> para generar tu primera valoración.
            </div>
          </div>
        )}

        {/* ── Quick stats side panel ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 180 }}>
          <StatBox label="Eventos registrados" value={fmtNum(dbStats?.totalEvents ?? 0)} />
          <StatBox label="Ventas registradas" value={fmtNum(dbStats?.totalSales ?? 0)} />
          <StatBox label="Score promedio" value={
            valuations.length > 0
              ? String(Math.round(valuations.reduce((s, v) => s + v.scores.overall, 0) / valuations.length))
              : '—'
          } />
        </div>
      </div>

      {/* ── Recent valuations table ── */}
      {latestValuations.length > 0 && (
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 16, overflow: 'hidden', marginTop: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1A1612' }}>Últimas valoraciones</h2>
            <span style={{ fontSize: 11, color: '#C4BDB5' }}>{latestValuations.length} registros</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#FDFAF7' }}>
                {['Caballo', 'Fecha', 'Score', 'Mín', 'Máx', 'Riesgo'].map((h) => (
                  <th key={h} style={{ padding: '10px 18px', textAlign: 'left', fontSize: 10.5, color: '#9A9189', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {latestValuations.map((v) => (
                <tr key={v.id} className="ev-tr-hover" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', cursor: 'default' }}>
                  <td style={{ padding: '13px 18px', fontWeight: 600, color: '#1A1612', fontSize: 13.5 }}>{v.horseName}</td>
                  <td style={{ padding: '13px 18px', color: '#9A9189', fontSize: 12 }}>{v.date.split('T')[0]}</td>
                  <td style={{ padding: '13px 18px' }}>
                    <span style={{
                      background: scoreColor(v.scores.overall) + '18',
                      color: scoreColor(v.scores.overall),
                      borderRadius: 6, padding: '3px 9px', fontSize: 12.5, fontWeight: 700,
                    }}>{v.scores.overall}</span>
                  </td>
                  <td style={{ padding: '13px 18px', color: '#A0731A', fontWeight: 600, fontSize: 13 }}>{fmt(v.valueMin)}</td>
                  <td style={{ padding: '13px 18px', color: '#A0731A', fontWeight: 700, fontSize: 13 }}>{fmt(v.valueMax)}</td>
                  <td style={{ padding: '13px 18px' }}>
                    <span style={{
                      background: riskColor(v.risk) + '15', color: riskColor(v.risk),
                      borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 600,
                    }}>{v.risk}</span>
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

function KpiCard({ icon, label, value, accent, isString }: {
  icon: React.ReactNode; label: string; value: string; accent: string; isString?: boolean;
}) {
  return (
    <div className="ev-card-hover ev-kpi-hover" style={{
      background: '#FFFFFF',
      border: '1px solid rgba(0,0,0,0.07)',
      borderRadius: 14,
      padding: '20px 22px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 9,
        background: accent + '14',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: accent, marginBottom: 14,
      }}>{icon}</div>
      <div style={{ fontSize: isString ? 22 : 28, fontWeight: 800, color: '#1A1612', letterSpacing: '-0.5px', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: '#9A9189', marginTop: 6, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid rgba(0,0,0,0.07)',
      borderRadius: 12, padding: '14px 16px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
    }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#1A1612', letterSpacing: '-0.3px' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#C4BDB5', marginTop: 3, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

function scoreColor(s: number) {
  if (s >= 70) return '#16A34A';
  if (s >= 45) return '#D97706';
  return '#DC2626';
}
function riskColor(r: 'low' | 'medium' | 'high') {
  return { low: '#16A34A', medium: '#D97706', high: '#DC2626' }[r];
}

