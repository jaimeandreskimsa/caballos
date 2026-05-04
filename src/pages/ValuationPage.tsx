import { useState, useRef } from 'react';
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
    <div style={{ padding: '32px', maxWidth: 920, background: '#F6F9FC', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: '#0A2540', letterSpacing: '-0.4px' }}>
          Valoración AI
        </h1>
        <p style={{ margin: 0, color: '#697386', fontSize: 14 }}>
          Genera una valoración basada en performance, linaje y mercado ecuestre.
        </p>
      </div>

      {/* Horse search */}
      <div style={{ marginBottom: 24, position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#A3ACBA', pointerEvents: 'none' }} />
          <input
            value={searchQ}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Buscar caballo por nombre en la base de datos…"
            className="ev-input"
            style={{ width: '100%', paddingLeft: 36, paddingTop: 12, paddingBottom: 12, paddingRight: horse && !searchQ ? 180 : 12, fontSize: 14, boxSizing: 'border-box' }}
          />
          {horse && !searchQ && (
            <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#635BFF', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                ✓ {horse.name}
              </span>
              <button onClick={() => { selectHorse(null); setSelectedDBHorse(null); }} style={{ background: 'rgba(229,72,59,0.08)', border: '1px solid rgba(229,72,59,0.2)', borderRadius: 6, cursor: 'pointer', color: '#E5483B', padding: '2px 6px', lineHeight: 0 }}>
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Dropdown */}
        {searchQ && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            background: '#FFFFFF', border: '1px solid #E3E8EF', borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.10)', marginTop: 6, overflow: 'hidden',
          }}>
            {searchLoading && (
              <div style={{ padding: '13px 18px', fontSize: 13, color: '#A3ACBA', display: 'flex', alignItems: 'center', gap: 8 }}>
                🏇 Buscando…
              </div>
            )}
            {!searchLoading && searchResults.length === 0 && searchQ && (
              <div style={{ padding: '13px 18px', fontSize: 13, color: '#A3ACBA' }}>Sin resultados para "{searchQ}"</div>
            )}
            {searchResults.map((h) => (
              <div key={h.id} onClick={() => handleSelectDBHorse(h)}
                className="ev-tr-hover"
                style={{ padding: '11px 18px', cursor: 'pointer', borderBottom: '1px solid #F0F4F8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0A2540' }}>🐎 {h.name}</div>
                  {h.sire && <div style={{ fontSize: 11, color: '#A3ACBA', marginTop: 2 }}>Padre: {h.sire}</div>}
                </div>
                <div style={{ fontSize: 12, color: '#697386', textAlign: 'right' }}>
                  <div>{h.countryCode}</div>
                  {h.birthYear && <div style={{ color: '#A3ACBA', marginTop: 2 }}>{new Date().getFullYear() - h.birthYear}a · {h.birthYear}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!horse && !searchQ && (
        <div style={{ padding: '72px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 12, opacity: 0.15 }}>🏇</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#0A2540', marginBottom: 6 }}>Busca un caballo para valorar</div>
          <div style={{ fontSize: 13, color: '#A3ACBA' }}>Escribe el nombre arriba y selecciona de la base de datos (1821+ caballos)</div>
        </div>
      )}

      {horse && (
        <>
          {/* Horse summary card */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E3E8EF', borderRadius: 12, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#A3ACBA', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14 }}>Ficha del caballo</div>
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
          <div style={{ background: '#FFFFFF', border: '1px solid #E3E8EF', borderRadius: 12, marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#0A2540' }}>
                  Agregar resultados manualmente
                </h3>
                <button onClick={addManualResult} className="ev-btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: 12 }}>
                  <Plus size={13} /> Resultado
                </button>
              </div>

              {manualResults.length === 0 && (
                <p style={{ color: '#A3ACBA', fontSize: 13, margin: 0 }}>
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
                  <button onClick={() => setManualResults((prev) => prev.filter((_, idx) => idx !== i))} style={{ background: 'rgba(229,72,59,0.06)', border: '1px solid rgba(229,72,59,0.18)', borderRadius: 8, cursor: 'pointer', color: '#E5483B', padding: '6px 8px', lineHeight: 0 }}>
                    <Minus size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerateValuation}
            disabled={loading}
            className={loading ? '' : 'ev-btn-gold'}
            style={{
              width: '100%', borderRadius: 12, padding: '15px', fontWeight: 800, fontSize: 16,
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 28,
              ...(loading ? { background: 'rgba(99,91,255,0.06)', color: '#A3ACBA', border: '1px solid #E3E8EF' } : {}),
            }}
          >
            <Zap size={18} />
            {loading ? 'Calculando valoración…' : 'Generar valoración AI'}
          </button>

          {latestValuation && <ValuationCard valuation={latestValuation} />}
        </>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: '#A3ACBA', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 3, color: '#0A2540' }}>{value}</div>
    </div>
  );
}

function FieldWrap({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 10, color: '#A3ACBA', fontWeight: 700, letterSpacing: '0.06em' }}>{label}</span>
      {children}
    </div>
  );
}

const fieldStyle: React.CSSProperties = { padding: '7px 10px', fontSize: 12 };
