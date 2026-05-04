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

  if (false) {  // removed old empty-state guard — search handles it
    return null;
  }

  return (
    <div style={{ padding: '32px', maxWidth: 900 }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, color: '#111111', letterSpacing: '-0.5px' }}>Valoración</h1>
      <p style={{ margin: '0 0 28px', color: '#888888', fontSize: 14 }}>Genera una valoración AI basada en performance, linaje y mercado.</p>

      {/* Horse search */}
      <div style={{ marginBottom: 24, position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#AAAAAA', pointerEvents: 'none' }} />
          <input
            value={searchQ}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Buscar caballo por nombre…"
            style={{
              width: '100%', paddingLeft: 36, paddingRight: horse ? 200 : 12,
              paddingTop: 12, paddingBottom: 12,
              border: '1px solid #E0E0E0', borderRadius: 10,
              fontSize: 14, color: '#111111', background: '#FFFFFF',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          {horse && !searchQ && (
            <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#111111', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {horse.name}
              </span>
              <button onClick={() => { selectHorse(null); setSelectedDBHorse(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#AAAAAA', padding: 2 }}>
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Dropdown results */}
        {searchQ && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
            background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 10,
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)', marginTop: 4, overflow: 'hidden',
          }}>
            {searchLoading && (
              <div style={{ padding: '12px 16px', fontSize: 13, color: '#888888' }}>Buscando…</div>
            )}
            {!searchLoading && searchResults.length === 0 && searchQ && (
              <div style={{ padding: '12px 16px', fontSize: 13, color: '#888888' }}>Sin resultados para "{searchQ}"</div>
            )}
            {searchResults.map((h) => (
              <div key={h.id} onClick={() => handleSelectDBHorse(h)}
                style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid #F5F5F5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#111111' }}>{h.name}</div>
                  {h.sire && <div style={{ fontSize: 11, color: '#AAAAAA' }}>Padre: {h.sire}</div>}
                </div>
                <div style={{ fontSize: 12, color: '#888888', textAlign: 'right' }}>
                  <div>{h.countryCode}</div>
                  {h.birthYear && <div>{new Date().getFullYear() - h.birthYear}a · {h.birthYear}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!horse && !searchQ && (
        <div style={{ padding: '48px 20px', textAlign: 'center', color: '#AAAAAA' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🐎</div>
          <div style={{ fontSize: 14 }}>Busca un caballo por nombre para comenzar la valoración</div>
        </div>
      )}

      {horse && (
        <>
          {/* Horse summary */}
          <div style={{
            background: '#FAFAFA', border: '1px solid #EBEBEB', borderRadius: 12,
            padding: '16px 20px', marginBottom: 24, display: 'flex', gap: 24, flexWrap: 'wrap',
          }}>
            <Info label="Nombre" value={horse.name} />
            <Info label="Edad" value={`${horse.age} años`} />
            <Info label="Studbook" value={horse.studbook || '—'} />
            <Info label="Padre" value={horse.sire || '—'} />
            <Info label="País" value={horse.country || '—'} />
            <Info label="Resultados" value={`${horseResults.length} cargados`} />
          </div>

          {/* Manual results */}
          <div style={{ background: '#111c11', border: '1px solid #2a3f2a', borderRadius: 12, padding: '20px', marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 14, color: '#c9a84c' }}>Agregar resultados manualmente</h3>
              <button
                onClick={addManualResult}
                style={{ background: '#2a3f2a', color: '#4caf50', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
              >
                <Plus size={13} /> Resultado
              </button>
            </div>

            {manualResults.length === 0 && (
              <p style={{ color: '#888888', fontSize: 13, margin: 0 }}>
                Sin resultados manuales. Presiona "+ Resultado" para agregar, o genera la valoración con los datos existentes.
              </p>
            )}

            {manualResults.map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 10, color: '#888888', fontWeight: 600 }}>EVENTO</span>
                  <input
                    value={r.eventName ?? ''}
                    onChange={(e) => updateManualResult(i, { eventName: e.target.value })}
                    placeholder="Nombre evento"
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 10, color: '#888888', fontWeight: 600 }}>FECHA</span>
                  <input
                    type="date"
                    value={r.eventDate ?? ''}
                    onChange={(e) => updateManualResult(i, { eventDate: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 10, color: '#888888', fontWeight: 600 }}>NIVEL</span>
                  <select
                    value={r.level ?? '1.20m'}
                    onChange={(e) => updateManualResult(i, { level: e.target.value as JumpingLevel })}
                    style={inputStyle}
                  >
                    {LEVELS.map((l) => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 10, color: '#888888', fontWeight: 600 }}>FAULTS</span>
                  <input
                    type="number" min={0} max={40}
                    value={r.faults ?? 0}
                    onChange={(e) => updateManualResult(i, { faults: +e.target.value })}
                    style={{ ...inputStyle, width: 70 }}
                  />
                </div>
                <button
                  onClick={() => setManualResults((prev) => prev.filter((_, idx) => idx !== i))}
                  style={{ background: 'none', border: 'none', color: '#CCCCCC', cursor: 'pointer', padding: '6px' }}
                >
                  <Minus size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerateValuation}
            disabled={loading}
            style={{
              width: '100%', background: loading ? '#F0F0F0' : '#111111',
              color: loading ? '#AAAAAA' : '#FFFFFF', border: 'none', borderRadius: 12,
              padding: '14px', fontWeight: 800, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 28,
            }}
          >
            <Zap size={18} />
            {loading ? 'Calculando...' : 'Generar valoración AI'}
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
      <div style={{ fontSize: 10, color: '#888888', fontWeight: 600, letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2, color: '#111111' }}>{value}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: '#FFFFFF', border: '1px solid #E8E8E8', color: '#111111',
  borderRadius: 8, padding: '7px 10px', fontSize: 12, outline: 'none', fontFamily: 'inherit',
};
