import { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { BarChart3, RefreshCw, Database, Globe, Play, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { runSync } from '../services/sync';
import { serverGetDBStats } from '../services/serverDB';
import type { SyncProgress } from '../services/sync';

export default function DataPage() {
  const { results, scrapeJobs, horses, syncProgress, setSyncProgress, setDbStats, dbStats } = useAppStore();
  const [localProgress, setLocalProgress] = useState<SyncProgress | null>(syncProgress);
  const [isRunning, setIsRunning] = useState(false);

  const bySource = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.source] = (acc[r.source] ?? 0) + 1;
    return acc;
  }, {});

  // Load DB stats on mount (from server/PostgreSQL)
  useEffect(() => {
    serverGetDBStats().then(s => {
      setDbStats({ ...s, lastSyncBySource: {} });
    }).catch(() => {});
  }, [setDbStats]);

  const handleSync = async (force = false) => {
    if (isRunning) return;
    setIsRunning(true);
    await runSync((p) => {
      setLocalProgress(p);
      setSyncProgress(p);
    }, force);
    // Refresh stats after sync
    serverGetDBStats().then(s => setDbStats({ ...s, lastSyncBySource: {} })).catch(() => {});
    setIsRunning(false);
  };

  const progressPct = localProgress
    ? Math.round((localProgress.stepsDone / localProgress.stepsTotal) * 100)
    : 0;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 980, background: 'var(--c-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 26 }} className="ev-horse-icon">📡</span>
            <h1 style={{
              margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px',
              background: 'linear-gradient(135deg, #F0EDE8 0%, #C9972C 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>Datos &amp; Fuentes</h1>
          </div>
          <p style={{ margin: 0, color: 'rgba(160,143,130,0.55)', fontSize: 14 }}>
            FEI · Equipe · FEDECUARG · CBH Brasil · Subastas argentinas
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => handleSync(false)} disabled={isRunning} className="ev-btn-ghost" style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', fontSize: 13,
            opacity: isRunning ? 0.5 : 1, cursor: isRunning ? 'not-allowed' : 'pointer',
          }}>
            <RefreshCw size={13} style={{ animation: isRunning ? 'spin 1s linear infinite' : undefined }} />
            Sync incremental
          </button>
          <button onClick={() => handleSync(true)} disabled={isRunning} className="ev-btn-gold" style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', fontSize: 13,
            opacity: isRunning ? 0.5 : 1, cursor: isRunning ? 'not-allowed' : 'pointer',
          }}>
            <Play size={13} />
            Sync completo
          </button>
        </div>
      </div>

      {/* Sync progress bar */}
      {localProgress && (
        <div className="ev-gradient-card" style={{ marginBottom: 20 }}>
          <div style={{ padding: '18px 22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {localProgress.status === 'syncing' && (
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#F59E0B', animation: 'pulse-gold 1.2s ease-in-out infinite' }} />
                )}
                {localProgress.status === 'done' && <CheckCircle size={16} color="#22C55E" />}
                {localProgress.status === 'error' && <AlertCircle size={16} color="#EF4444" />}
                <span style={{ fontSize: 13, fontWeight: 700, color: '#F0EDE8' }}>
                  {localProgress.status === 'syncing' ? `Sincronizando: ${localProgress.currentSource ?? '...'}` :
                   localProgress.status === 'done' ? '✓ Sincronización completada' :
                   localProgress.status === 'error' ? `⚠ Error: ${localProgress.lastError}` : 'Listo'}
                </span>
              </div>
              <span style={{ fontSize: 12, color: 'rgba(160,143,130,0.5)', fontWeight: 600 }}>
                {localProgress.stepsDone} / {localProgress.stepsTotal} pasos
              </span>
            </div>
            <div style={{ height: 7, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden', marginBottom: 14 }}>
              <div style={{
                height: '100%', width: `${progressPct}%`,
                background: localProgress.status === 'error' ? '#EF4444' :
                             localProgress.status === 'done' ? '#22C55E' : 'linear-gradient(90deg, #C9972C, #F0B429)',
                borderRadius: 99, transition: 'width 0.4s ease',
                boxShadow: '0 0 8px rgba(201,151,44,0.4)',
              }} />
            </div>
            <div style={{ display: 'flex', gap: 20, fontSize: 12, flexWrap: 'wrap' }}>
              {[
                { emoji: '🐴', label: 'caballos', val: localProgress.horsesImported },
                { emoji: '📊', label: 'resultados', val: localProgress.resultsImported },
                { emoji: '🏟️', label: 'eventos', val: localProgress.eventsImported },
                { emoji: '💰', label: 'subastas', val: localProgress.salesImported },
              ].map(({ emoji, label, val }) => (
                <span key={label} style={{ color: 'rgba(160,143,130,0.5)' }}>
                  {emoji} <strong style={{ color: '#F0EDE8' }}>{val}</strong> {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DB Stats KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { icon: <Database size={16} />, label: 'Caballos en DB',    value: dbStats?.totalHorses ?? 0,  accent: '#6366F1', emoji: '🐎' },
          { icon: <BarChart3 size={16} />, label: 'Resultados en DB', value: dbStats?.totalResults ?? 0, accent: '#22C55E', emoji: '📊' },
          { icon: <Globe size={16} />,    label: 'Eventos indexados', value: dbStats?.totalEvents ?? 0,  accent: '#3B82F6', emoji: '🏟️' },
          { icon: <Clock size={16} />,    label: 'Ventas registradas',value: dbStats?.totalSales ?? 0,   accent: '#F59E0B', emoji: '💰' },
          { icon: <Database size={16} />, label: 'Resultados sesión', value: results.length,            accent: 'rgba(201,151,44,0.4)', emoji: '📋' },
          { icon: <Globe size={16} />,    label: 'Caballos sesión',   value: horses.length,             accent: 'rgba(201,151,44,0.4)', emoji: '🏇' },
        ].map(({ icon, label, value, accent, emoji }) => (
          <div key={label} className="ev-gradient-card" style={{ cursor: 'default' }}>
            <div style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: accent + '1A', border: `1px solid ${accent}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent }}>
                  {icon}
                </div>
                <span style={{ fontSize: 18, opacity: 0.55 }}>{emoji}</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.4px', color: '#F0EDE8' }}>
                {value.toLocaleString('es-AR')}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(160,143,130,0.55)', marginTop: 4 }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Sources breakdown by session */}
      {results.length > 0 && (
        <div className="ev-gradient-card" style={{ marginBottom: 20 }}>
          <div style={{ padding: '16px 20px' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'rgba(201,151,44,0.7)' }}>📋 Resultados en sesión por fuente</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Object.entries(bySource).map(([src, count]) => (
                <div key={src} style={{
                  background: 'rgba(201,151,44,0.08)', border: '1px solid rgba(201,151,44,0.2)',
                  borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: '#F0B429',
                }}>
                  {src}: {count}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Data sources catalog */}
      <div className="ev-gradient-card" style={{ marginBottom: 20 }}>
        <div style={{ borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ padding: '16px 22px', borderBottom: '1px solid rgba(201,151,44,0.08)', background: 'rgba(0,0,0,0.15)' }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#F0EDE8' }}>🌐 Fuentes de datos</h2>
          </div>
          {[
            { name: 'FEI — International Jumping', desc: 'Catálogo global de caballos FEI. Filtrable por país (ARG, BRA, URU, PAR). Horses list + event results públicos.', status: 'active', method: 'HTML scraping · fei.org/jumping/horses?country=ARG', countries: '🇦🇷 🇧🇷 🇺🇾 🇵🇾' },
            { name: 'Equipe Technology — Shows SA', desc: 'Software de gestión de concursos. Usado en +80% de eventos de Argentina y Brasil. Startlists y resultados públicos.', status: 'active', method: 'HTML scraping · equipe.com/Jumping/Show/{ID}/StartList/', countries: '🇦🇷 🇧🇷' },
            { name: 'FEDECUARG — Resultados Nacionales', desc: '+764 resultados argentinos (CSI1*/2*/3*, CICO A/B/C, Nacionales). Metadatos + links a PDFs en Google Drive.', status: 'partial', method: 'HTML scraping de posts + extracción de Google Drive links', countries: '🇦🇷' },
            { name: 'CBH — Confederação Brasileira de Hipismo', desc: 'Rankings nacionales, calendario de eventos, resultados por disciplina.', status: 'partial', method: 'HTML scraping · cbh.org.br/ranking + /resultados', countries: '🇧🇷' },
            { name: 'Fin del Mundo Remates', desc: 'Subastas de caballos argentinos. Catálogos públicos con nombre, haras, pedigrí.', status: 'partial', method: 'HTML scraping · listas de lotes públicas · precios privados', countries: '🇦🇷' },
            { name: 'DATAFECH — Chile', desc: 'Sistema oficial FEDECH. API REST con inscripciones, eventos CSN y buscador de jinetes/caballos.', status: 'active', method: 'API REST · /search/all, /inscription/horse', countries: '🇨🇱' },
            { name: 'Jumpr — jum.pr', desc: 'Stats de show jumping: % clear rounds, podiums. Principalmente Europa y EEUU.', status: 'partial', method: 'API reverse-engineered · cobertura limitada ARG/BRA', countries: '🌍' },
            { name: 'FPH Brazil — fph.com.br', desc: 'Calendario y resultados de competencias (Federação Paulista de Hipismo).', status: 'active', method: 'HTML scraping', countries: '🇧🇷' },
          ].map((s) => (
            <div key={s.name} style={{
              padding: '14px 22px', borderBottom: '1px solid rgba(255,255,255,0.03)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16,
            }} className="ev-tr-hover">
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#F0EDE8' }}>{s.name}</span>
                  <span style={{ fontSize: 14 }}>{s.countries}</span>
                </div>
                <div style={{ fontSize: 12, color: 'rgba(160,143,130,0.6)', marginTop: 3 }}>{s.desc}</div>
                <div style={{ fontSize: 11, color: 'rgba(201,151,44,0.35)', marginTop: 4, fontFamily: 'monospace' }}>↳ {s.method}</div>
              </div>
              <span style={{
                background: s.status === 'active' ? 'rgba(34,197,94,0.1)' : s.status === 'partial' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)',
                color: s.status === 'active' ? '#22C55E' : s.status === 'partial' ? '#F59E0B' : '#EF4444',
                border: `1px solid ${s.status === 'active' ? 'rgba(34,197,94,0.25)' : s.status === 'partial' ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)'}`,
                borderRadius: 999, padding: '3px 12px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
              }}>
                {s.status === 'active' ? '✓ Activo' : s.status === 'partial' ? '⚡ Parcial' : '✗ Bloqueado'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Last sync per source */}
      {dbStats && Object.keys(dbStats.lastSyncBySource).length > 0 && (
        <div className="ev-gradient-card" style={{ marginBottom: 20 }}>
          <div style={{ borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '14px 22px', borderBottom: '1px solid rgba(201,151,44,0.08)', background: 'rgba(0,0,0,0.15)' }}>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#F0EDE8' }}>🕐 Última sincronización por fuente</h3>
            </div>
            {Object.entries(dbStats.lastSyncBySource).map(([src, ts]) => (
              <div key={src} style={{ padding: '11px 22px', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', fontSize: 13 }} className="ev-tr-hover">
                <span style={{ color: '#F0EDE8', fontWeight: 600 }}>{src}</span>
                <span style={{ color: 'rgba(160,143,130,0.5)', fontSize: 12 }}>{new Date(ts as string).toLocaleString('es-AR')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session results by horse */}
      {horses.length > 0 && (
        <div className="ev-gradient-card" style={{ marginBottom: 20 }}>
          <div style={{ borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '14px 22px', borderBottom: '1px solid rgba(201,151,44,0.08)', background: 'rgba(0,0,0,0.15)' }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#F0EDE8' }}>🏇 Resultados por caballo (sesión)</h2>
            </div>
            {horses.map((h) => {
              const count = results.filter((r) => r.horseId === h.id).length;
              return (
                <div key={h.id} style={{ padding: '12px 22px', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between' }} className="ev-tr-hover">
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#F0EDE8' }}>🐎 {h.name}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: count > 0 ? '#22C55E' : 'rgba(160,143,130,0.35)' }}>
                    {count} resultado{count !== 1 ? 's' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scrape jobs history */}
      {scrapeJobs.length > 0 && (
        <div className="ev-gradient-card">
          <div style={{ borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '14px 22px', borderBottom: '1px solid rgba(201,151,44,0.08)', background: 'rgba(0,0,0,0.15)' }}>
              <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#F0EDE8' }}>📜 Historial de importaciones</h2>
            </div>
            {scrapeJobs.slice(0, 20).map((j) => (
              <div key={j.id} style={{ padding: '12px 22px', borderBottom: '1px solid rgba(255,255,255,0.03)', display: 'flex', justifyContent: 'space-between', fontSize: 13 }} className="ev-tr-hover">
                <span style={{ color: 'rgba(160,143,130,0.7)' }}>{j.source} · {j.startedAt?.split('T')[0]}</span>
                <span style={{ color: j.status === 'done' ? '#22C55E' : j.status === 'error' ? '#EF4444' : '#F59E0B', fontWeight: 600 }}>
                  {j.status} · {j.recordsFound} registros
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
