import { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { BarChart3, RefreshCw, Database, Globe, Play, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { runSync, getDBStats } from '../services/sync';
import type { SyncProgress } from '../services/sync';

export default function DataPage() {
  const { results, scrapeJobs, horses, syncProgress, setSyncProgress, setDbStats, dbStats } = useAppStore();
  const [localProgress, setLocalProgress] = useState<SyncProgress | null>(syncProgress);
  const [isRunning, setIsRunning] = useState(false);

  const bySource = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.source] = (acc[r.source] ?? 0) + 1;
    return acc;
  }, {});

  // Load DB stats on mount
  useEffect(() => {
    getDBStats().then(s => {
      setDbStats(s);
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
    getDBStats().then(s => setDbStats(s)).catch(() => {});
    setIsRunning(false);
  };

  const progressPct = localProgress
    ? Math.round((localProgress.stepsDone / localProgress.stepsTotal) * 100)
    : 0;

  return (
    <div style={{ padding: 32, maxWidth: 960 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: '#111111', letterSpacing: '-0.5px' }}>
          Datos &amp; Fuentes
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => handleSync(false)}
            disabled={isRunning}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              borderRadius: 8, border: '1px solid #E5E7EB',
              background: '#FFFFFF', color: '#374151', fontSize: 13, fontWeight: 600,
              cursor: isRunning ? 'not-allowed' : 'pointer', opacity: isRunning ? 0.6 : 1,
            }}
          >
            <RefreshCw size={14} style={{ animation: isRunning ? 'spin 1s linear infinite' : undefined }} />
            Sync incremental
          </button>
          <button
            onClick={() => handleSync(true)}
            disabled={isRunning}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              borderRadius: 8, border: 'none',
              background: '#111111', color: '#FFFFFF', fontSize: 13, fontWeight: 600,
              cursor: isRunning ? 'not-allowed' : 'pointer', opacity: isRunning ? 0.6 : 1,
            }}
          >
            <Play size={14} />
            Sync completo
          </button>
        </div>
      </div>
      <p style={{ margin: '0 0 24px', color: '#888888', fontSize: 14 }}>
        Base de datos propia con datos de FEI, Equipe Technology, FEDECUARG, CBH Brasil y subastas argentinas.
      </p>

      {/* Sync progress bar */}
      {localProgress && (
        <div style={{
          background: '#FFFFFF', border: '1px solid #EBEBEB', borderRadius: 12,
          padding: '16px 20px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {localProgress.status === 'syncing' && (
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B',
                  animation: 'pulse 1.2s ease-in-out infinite' }} />
              )}
              {localProgress.status === 'done' && <CheckCircle size={16} color="#22C55E" />}
              {localProgress.status === 'error' && <AlertCircle size={16} color="#EF4444" />}
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111111' }}>
                {localProgress.status === 'syncing' ? `Sincronizando: ${localProgress.currentSource ?? '...'}` :
                 localProgress.status === 'done' ? 'Sincronización completada' :
                 localProgress.status === 'error' ? `Error: ${localProgress.lastError}` : 'Listo'}
              </span>
            </div>
            <span style={{ fontSize: 12, color: '#888888' }}>
              Paso {localProgress.stepsDone} / {localProgress.stepsTotal}
            </span>
          </div>
          <div style={{ height: 6, background: '#F3F4F6', borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{
              height: '100%',
              width: `${progressPct}%`,
              background: localProgress.status === 'error' ? '#EF4444' :
                          localProgress.status === 'done' ? '#22C55E' : '#D4A843',
              borderRadius: 99,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ display: 'flex', gap: 20, fontSize: 12, color: '#888888' }}>
            <span>🐴 <strong style={{ color: '#111111' }}>{localProgress.horsesImported}</strong> caballos</span>
            <span>📊 <strong style={{ color: '#111111' }}>{localProgress.resultsImported}</strong> resultados</span>
            <span>🏟️ <strong style={{ color: '#111111' }}>{localProgress.eventsImported}</strong> eventos</span>
            <span>💰 <strong style={{ color: '#111111' }}>{localProgress.salesImported}</strong> subastas</span>
          </div>
        </div>
      )}

      {/* DB Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 24 }}>
        <StatCard icon={<Database size={18} />} label="Caballos en DB" value={dbStats?.totalHorses ?? 0} color="#6366F1" />
        <StatCard icon={<BarChart3 size={18} />} label="Resultados en DB" value={dbStats?.totalResults ?? 0} color="#22C55E" />
        <StatCard icon={<Globe size={18} />} label="Eventos indexados" value={dbStats?.totalEvents ?? 0} color="#3B82F6" />
        <StatCard icon={<Clock size={18} />} label="Registros de venta" value={dbStats?.totalSales ?? 0} color="#F59E0B" />
        <StatCard icon={<Database size={18} />} label="Resultados sesión" value={results.length} color="#888888" />
        <StatCard icon={<Globe size={18} />} label="Caballos sesión" value={horses.length} color="#888888" />
      </div>

      {/* Sources breakdown */}
      {results.length > 0 && (
        <div style={{ background: '#FFFFFF', border: '1px solid #EBEBEB', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: '#111111' }}>Resultados en sesión por fuente</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Object.entries(bySource).map(([src, count]) => (
              <div key={src} style={{
                background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8,
                padding: '6px 12px', fontSize: 12, fontWeight: 600, color: '#374151',
              }}>
                {src}: {count}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data sources catalog */}
      <div style={{ background: '#FFFFFF', border: '1px solid #EBEBEB', borderRadius: 14, overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F0F0' }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111111' }}>Fuentes de datos</h2>
        </div>
        {[
          {
            name: 'FEI — International Jumping',
            desc: 'Catálogo global de caballos FEI. Filtrable por país (ARG, BRA, URU, PAR). Horses list + event results públicos.',
            status: 'active',
            method: 'HTML scraping · fei.org/jumping/horses?country=ARG',
            countries: '🇦🇷 🇧🇷 🇺🇾 🇵🇾',
          },
          {
            name: 'Equipe Technology — Shows SA',
            desc: 'Software de gestión de concursos. Usado en +80% de eventos de Argentina y Brasil. Startlists y resultados públicos.',
            status: 'active',
            method: 'HTML scraping · equipe.com/Jumping/Show/{ID}/StartList/',
            countries: '🇦🇷 🇧🇷',
          },
          {
            name: 'FEDECUARG — Resultados Nacionales',
            desc: '+764 resultados argentinos (CSI1*/2*/3*, CICO A/B/C, Nacionales). Metadatos + links a PDFs en Google Drive.',
            status: 'partial',
            method: 'HTML scraping de posts + extracción de Google Drive links',
            countries: '🇦🇷',
          },
          {
            name: 'CBH — Confederação Brasileira de Hipismo',
            desc: 'Rankings nacionales, calendario de eventos, resultados por disciplina.',
            status: 'partial',
            method: 'HTML scraping · cbh.org.br/ranking + /resultados',
            countries: '🇧🇷',
          },
          {
            name: 'Fin del Mundo Remates',
            desc: 'Subastas de caballos argentinos. Catálogos públicos con nombre, haras, pedigrí.',
            status: 'partial',
            method: 'HTML scraping · listas de lotes públicas · precios privados',
            countries: '🇦🇷',
          },
          {
            name: 'DATAFECH — Chile',
            desc: 'Sistema oficial FEDECH. API REST con inscripciones, eventos CSN y buscador de jinetes/caballos.',
            status: 'active',
            method: 'API REST · /search/all, /inscription/horse',
            countries: '🇨🇱',
          },
          {
            name: 'Jumpr — jum.pr',
            desc: 'Stats de show jumping: % clear rounds, podiums. Principalmente Europa y EEUU.',
            status: 'partial',
            method: 'API reverse-engineered · cobertura limitada ARG/BRA',
            countries: '🌍',
          },
          {
            name: 'FPH Brazil — fph.com.br',
            desc: 'Calendario y resultados de competencias (Federação Paulista de Hipismo).',
            status: 'active',
            method: 'HTML scraping',
            countries: '🇧🇷',
          },
        ].map((s) => (
          <div key={s.name} style={{
            padding: '14px 20px', borderBottom: '1px solid #F5F5F5',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: '#111111' }}>{s.name}</span>
                <span style={{ fontSize: 12 }}>{s.countries}</span>
              </div>
              <div style={{ fontSize: 12, color: '#888888', marginTop: 3 }}>{s.desc}</div>
              <div style={{ fontSize: 11, color: '#AAAAAA', marginTop: 4 }}>Método: {s.method}</div>
            </div>
            <span style={{
              background: s.status === 'active' ? '#4caf5020' : s.status === 'partial' ? '#ff980020' : '#f4433620',
              color: s.status === 'active' ? '#4caf50' : s.status === 'partial' ? '#ff9800' : '#f44336',
              border: `1px solid ${s.status === 'active' ? '#4caf5040' : s.status === 'partial' ? '#ff980040' : '#f4433640'}`,
              borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
            }}>
              {s.status === 'active' ? '✓ Activo' : s.status === 'partial' ? '⚡ Parcial' : '✗ Bloqueado'}
            </span>
          </div>
        ))}
      </div>

      {/* Last sync timestamps */}
      {dbStats && Object.keys(dbStats.lastSyncBySource).length > 0 && (
        <div style={{ background: '#FFFFFF', border: '1px solid #EBEBEB', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0F0F0' }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#111111' }}>Última sincronización por fuente</h3>
          </div>
          {Object.entries(dbStats.lastSyncBySource).map(([src, ts]) => (
            <div key={src} style={{ padding: '10px 20px', borderBottom: '1px solid #F5F5F5', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: '#374151', fontWeight: 500 }}>{src}</span>
              <span style={{ color: '#888888' }}>{new Date(ts as string).toLocaleString('es-AR')}</span>
            </div>
          ))}
        </div>
      )}

      {/* Session results by horse */}
      {horses.length > 0 && (
        <div style={{ background: '#FFFFFF', border: '1px solid #EBEBEB', borderRadius: 14, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F0F0' }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111111' }}>Resultados por caballo (sesión)</h2>
          </div>
          {horses.map((h) => {
            const count = results.filter((r) => r.horseId === h.id).length;
            return (
              <div key={h.id} style={{
                padding: '12px 20px', borderBottom: '1px solid #F5F5F5',
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#111111' }}>{h.name}</span>
                <span style={{ fontSize: 13, color: count > 0 ? '#22C55E' : '#AAAAAA' }}>
                  {count} resultado{count !== 1 ? 's' : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Scrape jobs */}
      {scrapeJobs.length > 0 && (
        <div style={{ background: '#FFFFFF', border: '1px solid #EBEBEB', borderRadius: 14, overflow: 'hidden', marginTop: 24 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #F0F0F0' }}>
            <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#111111' }}>Historial de importaciones</h2>
          </div>
          {scrapeJobs.slice(0, 20).map((j) => (
            <div key={j.id} style={{ padding: '12px 20px', borderBottom: '1px solid #F5F5F5', display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: '#555555' }}>{j.source} · {j.startedAt?.split('T')[0]}</span>
              <span style={{ color: j.status === 'done' ? '#22C55E' : j.status === 'error' ? '#EF4444' : '#F59E0B' }}>
                {j.status} · {j.recordsFound} registros
              </span>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #EBEBEB', borderRadius: 12, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
      <div style={{ color, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#111111' }}>{value.toLocaleString('es-AR')}</div>
      <div style={{ fontSize: 12, color: '#888888', marginTop: 4 }}>{label}</div>
    </div>
  );
}
