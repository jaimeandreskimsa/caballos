import { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { BarChart3, RefreshCw, Database, Globe, Play, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { runSync } from '../services/sync';
import { serverGetDBStats } from '../services/serverDB';
import type { SyncProgress } from '../services/sync';

const SOURCES = [
  { name: 'FEI — International Jumping', desc: 'Catálogo global de caballos FEI. Filtrable por país (ARG, BRA, URU, PAR). Horses list + event results públicos.', status: 'active', method: 'HTML scraping · fei.org/jumping/horses?country=ARG', countries: '🇦🇷 🇧🇷 🇺🇾 🇵🇾' },
  { name: 'Equipe Technology — Shows SA', desc: 'Software de gestión de concursos. Usado en +80% de eventos de Argentina y Brasil. Startlists y resultados públicos.', status: 'active', method: 'HTML scraping · equipe.com/Jumping/Show/{ID}/StartList/', countries: '🇦🇷 🇧🇷' },
  { name: 'FEDECUARG — Resultados Nacionales', desc: '+764 resultados argentinos (CSI1*/2*/3*, CICO A/B/C, Nacionales). Metadatos + links a PDFs en Google Drive.', status: 'partial', method: 'HTML scraping de posts + extracción de Google Drive links', countries: '🇦🇷' },
  { name: 'CBH — Confederação Brasileira de Hipismo', desc: 'Rankings nacionales, calendario de eventos, resultados por disciplina.', status: 'partial', method: 'HTML scraping · cbh.org.br/ranking + /resultados', countries: '🇧🇷' },
  { name: 'Fin del Mundo Remates', desc: 'Subastas de caballos argentinos. Catálogos públicos con nombre, haras, pedigrí.', status: 'partial', method: 'HTML scraping · listas de lotes públicas · precios privados', countries: '🇦🇷' },
  { name: 'DATAFECH — Chile', desc: 'Sistema oficial FEDECH. API REST con inscripciones, eventos CSN y buscador de jinetes/caballos.', status: 'active', method: 'API REST · /search/all, /inscription/horse', countries: '🇨🇱' },
  { name: 'Jumpr — jum.pr', desc: 'Stats de show jumping: % clear rounds, podiums. Principalmente Europa y EEUU.', status: 'partial', method: 'API reverse-engineered · cobertura limitada ARG/BRA', countries: '🌍' },
  { name: 'FPH Brazil — fph.com.br', desc: 'Calendario y resultados de competencias (Federação Paulista de Hipismo).', status: 'active', method: 'HTML scraping', countries: '🇧🇷' },
] as const;

const STATUS_COLOR = { active: '#30B57C', partial: '#F59E0B', blocked: '#E5483B' } as const;
const STATUS_LABEL = { active: '✓ Activo', partial: '⚡ Parcial', blocked: '✗ Bloqueado' } as const;

export default function DataPage() {
  const { results, scrapeJobs, horses, syncProgress, setSyncProgress, setDbStats, dbStats } = useAppStore();
  const [localProgress, setLocalProgress] = useState<SyncProgress | null>(syncProgress);
  const [isRunning, setIsRunning] = useState(false);

  const bySource = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.source] = (acc[r.source] ?? 0) + 1;
    return acc;
  }, {});

  useEffect(() => {
    serverGetDBStats().then(s => {
      setDbStats({ ...s, lastSyncBySource: {} });
    }).catch(() => {});
  }, [setDbStats]);

  const handleSync = async (force = false) => {
    if (isRunning) return;
    setIsRunning(true);
    await runSync((p) => { setLocalProgress(p); setSyncProgress(p); }, force);
    serverGetDBStats().then(s => setDbStats({ ...s, lastSyncBySource: {} })).catch(() => {});
    setIsRunning(false);
  };

  const progressPct = localProgress
    ? Math.round((localProgress.stepsDone / localProgress.stepsTotal) * 100)
    : 0;

  return (
    <div className="page-pad" style={{ padding: '32px', maxWidth: 980, background: '#F6F9FC', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-h1" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: '#0A2540', letterSpacing: '-0.4px' }}>Datos &amp; Fuentes</h1>
          <p style={{ margin: 0, color: '#697386', fontSize: 14 }}>FEI · Equipe · FEDECUARG · CBH Brasil · Subastas argentinas</p>
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

      {/* Progress bar */}
      {localProgress && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E3E8EF', borderRadius: 12, marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '18px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {localProgress.status === 'syncing' && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B' }} />}
              {localProgress.status === 'done' && <CheckCircle size={16} color="#30B57C" />}
              {localProgress.status === 'error' && <AlertCircle size={16} color="#E5483B" />}
              <span style={{ fontSize: 13, fontWeight: 600, color: '#0A2540' }}>
                {localProgress.status === 'syncing' ? `Sincronizando: ${localProgress.currentSource ?? '...'}` :
                 localProgress.status === 'done' ? 'Sincronización completada' :
                 localProgress.status === 'error' ? `Error: ${localProgress.lastError}` : 'Listo'}
              </span>
            </div>
            <span style={{ fontSize: 12, color: '#A3ACBA', fontWeight: 600 }}>
              {localProgress.stepsDone} / {localProgress.stepsTotal} pasos
            </span>
          </div>
          <div style={{ height: 6, background: '#F0F4F8', borderRadius: 99, overflow: 'hidden', marginBottom: 14 }}>
            <div style={{
              height: '100%', width: `${progressPct}%`,
              background: localProgress.status === 'error' ? '#E5483B' : localProgress.status === 'done' ? '#30B57C' : '#635BFF',
              borderRadius: 99, transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ display: 'flex', gap: 20, fontSize: 12, flexWrap: 'wrap' }}>
            {[
              { emoji: '🐴', label: 'caballos', val: localProgress.horsesImported },
              { emoji: '📊', label: 'resultados', val: localProgress.resultsImported },
              { emoji: '🏟️', label: 'eventos', val: localProgress.eventsImported },
              { emoji: '💰', label: 'subastas', val: localProgress.salesImported },
            ].map(({ emoji, label, val }) => (
              <span key={label} style={{ color: '#697386' }}>
                {emoji} <strong style={{ color: '#0A2540' }}>{val}</strong> {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { icon: <Database size={15} />, label: 'Caballos en DB',    value: dbStats?.totalHorses ?? 0,  accent: '#635BFF' },
          { icon: <BarChart3 size={15} />, label: 'Resultados en DB', value: dbStats?.totalResults ?? 0, accent: '#30B57C' },
          { icon: <Globe size={15} />,    label: 'Eventos indexados', value: dbStats?.totalEvents ?? 0,  accent: '#3B82F6' },
          { icon: <Clock size={15} />,    label: 'Ventas registradas',value: dbStats?.totalSales ?? 0,   accent: '#F59E0B' },
          { icon: <Database size={15} />, label: 'Resultados sesión', value: results.length,             accent: '#697386' },
          { icon: <Globe size={15} />,    label: 'Caballos sesión',   value: horses.length,              accent: '#697386' },
        ].map(({ icon, label, value, accent }) => (
          <div key={label} style={{ background: '#FFFFFF', border: '1px solid #E3E8EF', borderRadius: 12, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', cursor: 'default' }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: accent + '14', display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, marginBottom: 12 }}>
              {icon}
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.4px', color: '#0A2540' }}>
              {value.toLocaleString('es-AR')}
            </div>
            <div style={{ fontSize: 11, color: '#A3ACBA', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Session by source */}
      {results.length > 0 && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E3E8EF', borderRadius: 12, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '16px 20px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#0A2540' }}>Resultados en sesión por fuente</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(bySource).map(([src, count]) => (
              <div key={src} style={{ background: 'rgba(99,91,255,0.06)', border: '1px solid rgba(99,91,255,0.15)', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 600, color: '#635BFF' }}>
                {src}: {count}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sources catalog */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E3E8EF', borderRadius: 12, overflow: 'hidden', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0F4F8', background: '#F8FAFC' }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0A2540' }}>Fuentes de datos</h2>
        </div>
        {SOURCES.map((s) => (
          <div key={s.name} style={{ padding: '14px 20px', borderBottom: '1px solid #F0F4F8', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }} className="ev-tr-hover">
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontWeight: 700, fontSize: 13.5, color: '#0A2540' }}>{s.name}</span>
                <span style={{ fontSize: 13 }}>{s.countries}</span>
              </div>
              <div style={{ fontSize: 12, color: '#697386', marginBottom: 3 }}>{s.desc}</div>
              <div style={{ fontSize: 11, color: '#A3ACBA', fontFamily: 'monospace' }}>↳ {s.method}</div>
            </div>
            <span style={{
              background: STATUS_COLOR[s.status] + '12',
              color: STATUS_COLOR[s.status],
              border: `1px solid ${STATUS_COLOR[s.status]}25`,
              borderRadius: 999, padding: '3px 12px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
            }}>
              {STATUS_LABEL[s.status]}
            </span>
          </div>
        ))}
      </div>

      {/* Last sync per source */}
      {dbStats && Object.keys(dbStats.lastSyncBySource).length > 0 && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E3E8EF', borderRadius: 12, overflow: 'hidden', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0F4F8', background: '#F8FAFC' }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0A2540' }}>Última sincronización por fuente</h3>
          </div>
          {Object.entries(dbStats.lastSyncBySource).map(([src, ts]) => (
            <div key={src} style={{ padding: '11px 20px', borderBottom: '1px solid #F0F4F8', display: 'flex', justifyContent: 'space-between', fontSize: 13 }} className="ev-tr-hover">
              <span style={{ color: '#0A2540', fontWeight: 600 }}>{src}</span>
              <span style={{ color: '#A3ACBA', fontSize: 12 }}>{new Date(ts as string).toLocaleString('es-AR')}</span>
            </div>
          ))}
        </div>
      )}

      {/* Results by horse */}
      {horses.length > 0 && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E3E8EF', borderRadius: 12, overflow: 'hidden', marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0F4F8', background: '#F8FAFC' }}>
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0A2540' }}>Resultados por caballo (sesión)</h2>
          </div>
          {horses.map((h) => {
            const count = results.filter((r) => r.horseId === h.id).length;
            return (
              <div key={h.id} style={{ padding: '11px 20px', borderBottom: '1px solid #F0F4F8', display: 'flex', justifyContent: 'space-between' }} className="ev-tr-hover">
                <span style={{ fontSize: 13, fontWeight: 500, color: '#0A2540' }}>🐎 {h.name}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: count > 0 ? '#30B57C' : '#A3ACBA' }}>
                  {count} resultado{count !== 1 ? 's' : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Scrape jobs */}
      {scrapeJobs.length > 0 && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E3E8EF', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0F4F8', background: '#F8FAFC' }}>
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0A2540' }}>Historial de importaciones</h2>
          </div>
          {scrapeJobs.slice(0, 20).map((j) => (
            <div key={j.id} style={{ padding: '11px 20px', borderBottom: '1px solid #F0F4F8', display: 'flex', justifyContent: 'space-between', fontSize: 13 }} className="ev-tr-hover">
              <span style={{ color: '#697386' }}>{j.source} · {j.startedAt?.split('T')[0]}</span>
              <span style={{ color: j.status === 'done' ? '#30B57C' : j.status === 'error' ? '#E5483B' : '#F59E0B', fontWeight: 600 }}>
                {j.status} · {j.recordsFound} registros
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
