import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { calculateValuation } from '../services/valuation';
import { ValuationCard } from '../components/ValuationCard';
import { Zap, Plus, Minus, Search, X } from 'lucide-react';
import { serverSearchHorses } from '../services/serverDB';
import type { CompetitionResult, JumpingLevel, DBHorse } from '../types';

const LEVELS: JumpingLevel[] = ['1.00m','1.10m','1.20m','1.25m','1.30m','1.35m','1.40m','1.45m','1.50m','1.55m','1.60m','GP','GP*','GP**'];

export default function ValuationPage() {
  const { results, valuations, selectedHorseId, selectHorse, addValuation, addResults, addHorse } = useAppStore();
  const [manualResults, setManualResults] = useState<Partial<CompetitionResult>[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Horse search state ──────────────────────────────────────────────────────
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<DBHorse[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedDBHorse, setSelectedDBHorse] = useState<DBHorse | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (val: string) => {
    setSearchQ(val);
    if (!val.trim()) { setSearchResults([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await serverSearchHorses(val, 10);
        setSearchResults(res);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 300);
  };

  const handleSelectDBHorse = (dbh: DBHorse) => {
    // Convert DBHorse → Horse for valuation engine
    const horse: import('../types').Horse = {
      id: dbh.id,
      name: dbh.name,
      feiId: dbh.feiId,
      age: dbh.birthYear ? new Date().getFullYear() - dbh.birthYear : 0,
      breed: dbh.breed ?? dbh.studbook ?? '—',
      studbook: dbh.studbook,
      gender: dbh.gender ?? 'stallion',
      color: dbh.color,
      country: dbh.countryCode,
      sire: dbh.sire,
      dam: dbh.dam,
      damSire: dbh.damSire,
      rider: dbh.currentRider,
      owner: dbh.owner,
      createdAt: dbh.firstSeen,
      updatedAt: dbh.lastUpdated,
    };
    addHorse(horse);
    selectHorse(horse.id);
    setSelectedDBHorse(dbh);
    setSearchQ('');
    setSearchResults([]);
  };

  const { horses } = useAppStore();
  const horse = horses.find((h) => h.id === selectedHorseId) ?? null;
  const horseResults = results.filter((r) => r.horseId === horse?.id);
  const latestValuation = valuations.find((v) => v.horseId === horse?.id);

  const addManualResult = () => {
    setManualResults((prev) => [
      ...prev,
      { eventName: '', eventDate: new Date().toISOString().split('T')[0], level: '1.20m', faults: 0, clear: true, country: '', source: 'MANUAL' },
    ]);
  };

  const updateManualResult = (i: number, data: Partial<CompetitionResult>) => {
    setManualResults((prev) => prev.map((r, idx) => idx === i ? { ...r, ...data } : r));
  };

  const handleGenerateValuation = async () => {
    if (!horse) return;
    setLoading(true);

    // Save manual results
    const newResults: CompetitionResult[] = manualResults
      .filter((r) => r.eventName && r.eventDate && r.level)
      .map((r) => ({
        id: crypto.randomUUID(),
        horseId: horse.id,
        horseName: horse.name,
        eventName: r.eventName ?? '',
        eventDate: r.eventDate ?? '',
        level: r.level as JumpingLevel,
        faults: r.faults ?? 0,
        clear: (r.faults ?? 0) === 0,
        country: r.country ?? '',
        source: 'MANUAL',
      }));

    if (newResults.length > 0) addResults(newResults);

    const allResults = [...horseResults, ...newResults];
    const valuation = calculateValuation(horse, allResults);
    addValuation(valuation);
    setManualResults([]);
    setLoading(false);
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: 920, background: 'var(--c-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 28 }} className="ev-horse-icon">🏆</span>
          <h1 style={{
            margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.5px',
            background: 'linear-gradient(135deg, #F0EDE8 0%, #C9972C 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>Valoración AI</h1>
        </div>
        <p style={{ margin: 0, color: 'rgba(160,143,130,0.6)', fontSize: 14 }}>
          Genera una valoración basada en performance, linaje y mercado ecuestre.
        </p>
      </div>

      {/* Horse search */}
      <div style={{ marginBottom: 24, position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'rgba(201,151,44,0.5)', pointerEvents: 'none' }} />
          <input
            value={searchQ}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="🐎 Buscar caballo por nombre en la base de datos…"
            className="ev-input"
            style={{ width: '100%', paddingLeft: 38, paddingTop: 13, paddingBottom: 13, paddingRight: horse && !searchQ ? 180 : 14, fontSize: 14.5, boxSizing: 'border-box' }}
          />
          {horse && !searchQ && (
            <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#F0B429', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                ✓ {horse.name}
              </span>
              <button onClick={() => { selectHorse(null); setSelectedDBHorse(null); }} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, cursor: 'pointer', color: '#EF4444', padding: '2px 6px', lineHeight: 0 }}>
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Dropdown results */}
        {searchQ && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            background: '#131B27', border: '1px solid rgba(201,151,44,0.2)', borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)', marginTop: 6, overflow: 'hidden',
          }}>
            {searchLoading && (
              <div style={{ padding: '14px 18px', fontSize: 13, color: 'rgba(160,143,130,0.6)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ animation: 'hoofbeat 0.8s ease infinite', display: 'inline-block' }}>🏇</span> Buscando…
              </div>
            )}
            {!searchLoading && searchResults.length === 0 && searchQ && (
              <div style={{ padding: '14px 18px', fontSize: 13, color: 'rgba(160,143,130,0.5)' }}>Sin resultados para "{searchQ}"</div>
            )}
            {searchResults.map((h) => (
              <div key={h.id} onClick={() => handleSelectDBHorse(h)}
                className="ev-tr-hover"
                style={{ padding: '12px 18px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#F0EDE8' }}>🐎 {h.name}</div>
                  {h.sire && <div style={{ fontSize: 11, color: 'rgba(201,151,44,0.5)', marginTop: 2 }}>Padre: {h.sire}</div>}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(160,143,130,0.6)', textAlign: 'right' }}>
                  <div>{h.countryCode}</div>
                  {h.birthYear && <div style={{ color: 'rgba(201,151,44,0.4)', marginTop: 2 }}>{new Date().getFullYear() - h.birthYear}a · {h.birthYear}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!horse && !searchQ && (
        <div style={{ padding: '72px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 14, filter: 'drop-shadow(0 0 16px rgba(201,151,44,0.3))' }}>🏇</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F0EDE8', marginBottom: 6 }}>Busca un caballo para valorar</div>
          <div style={{ fontSize: 13, color: 'rgba(160,143,130,0.5)' }}>Escribe el nombre arriba y selecciona de la base de datos ({1821}+ caballos)</div>
        </div>
      )}

      {horse && (
        <>
          {/* Horse summary card */}
          <div className="ev-gradient-card" style={{ marginBottom: 18 }}>
            <div style={{ padding: '18px 22px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(201,151,44,0.5)', letterSpacing: '0.1em', marginBottom: 12, textTransform: 'uppercase' }}>📋 Ficha del caballo</div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <Info label="Nombre" value={horse.name} />
                <Info label="Edad" value={horse.age > 0 ? `${horse.age} años` : '—'} />
                <Info label="Studbook" value={horse.studbook || '—'} />
                <Info label="Padre" value={horse.sire || '—'} />
                <Info label="País" value={horse.country || '—'} />
                <Info label="Resultados" value={`${horseResults.length} cargados`} />
              </div>
            </div>
          </div>

          {/* Manual results */}
          <div className="ev-gradient-card" style={{ marginBottom: 18 }}>
            <div style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'rgba(201,151,44,0.8)', letterSpacing: '0.04em' }}>
                  📊 Agregar resultados manualmente
                </h3>
                <button onClick={addManualResult} className="ev-btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12 }}>
                  <Plus size={13} /> Resultado
                </button>
              </div>

              {manualResults.length === 0 && (
                <p style={{ color: 'rgba(160,143,130,0.45)', fontSize: 13, margin: 0 }}>
                  Sin resultados manuales. Presiona "+ Resultado" para agregar, o genera la valoración con los datos existentes.
                </p>
              )}

              {manualResults.map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <FieldWrap label="EVENTO">
                    <input value={r.eventName ?? ''} onChange={(e) => updateManualResult(i, { eventName: e.target.value })} placeholder="Nombre evento" className="ev-input" style={fieldStyle} />
                  </FieldWrap>
                  <FieldWrap label="FECHA">
                    <input type="date" value={r.eventDate ?? ''} onChange={(e) => updateManualResult(i, { eventDate: e.target.value })} className="ev-input" style={fieldStyle} />
                  </FieldWrap>
                  <FieldWrap label="NIVEL">
                    <select value={r.level ?? '1.20m'} onChange={(e) => updateManualResult(i, { level: e.target.value as JumpingLevel })} className="ev-input" style={fieldStyle}>
                      {LEVELS.map((l) => <option key={l}>{l}</option>)}
                    </select>
                  </FieldWrap>
                  <FieldWrap label="FAULTS">
                    <input type="number" min={0} max={40} value={r.faults ?? 0} onChange={(e) => updateManualResult(i, { faults: +e.target.value })} className="ev-input" style={{ ...fieldStyle, width: 70 }} />
                  </FieldWrap>
                  <button onClick={() => setManualResults((prev) => prev.filter((_, idx) => idx !== i))} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, cursor: 'pointer', color: '#EF4444', padding: '6px 8px', lineHeight: 0, marginBottom: 0 }}>
                    <Minus size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button onClick={handleGenerateValuation} disabled={loading} className={loading ? '' : 'ev-btn-gold'} style={{
            width: '100%',
            background: loading ? 'rgba(201,151,44,0.1)' : undefined,
            color: loading ? 'rgba(201,151,44,0.4)' : undefined,
            border: loading ? '1px solid rgba(201,151,44,0.2)' : undefined,
            borderRadius: 14, padding: '16px', fontWeight: 800, fontSize: 16,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 28,
          }}>
            <Zap size={18} />
            {loading ? 'Calculando valoración…' : '✨ Generar valoración AI'}
          </button>

          {/* Latest valuation */}
          {latestValuation && <ValuationCard valuation={latestValuation} />}
        </>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'rgba(201,151,44,0.45)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3, color: '#F0EDE8' }}>{value}</div>
    </div>
  );
}

function FieldWrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 10, color: 'rgba(201,151,44,0.5)', fontWeight: 700, letterSpacing: '0.06em' }}>{label}</span>
      {children}
    </div>
  );
}

const fieldStyle: React.CSSProperties = { padding: '7px 10px', fontSize: 12 };
