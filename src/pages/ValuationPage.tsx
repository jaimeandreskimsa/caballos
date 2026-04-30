import { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { calculateValuation } from '../services/valuation';
import { ValuationCard } from '../components/ValuationCard';
import { Zap, Plus, Minus } from 'lucide-react';
import type { CompetitionResult, JumpingLevel } from '../types';

const LEVELS: JumpingLevel[] = ['1.00m','1.10m','1.20m','1.25m','1.30m','1.35m','1.40m','1.45m','1.50m','1.55m','1.60m','GP','GP*','GP**'];

export default function ValuationPage() {
  const { horses, results, valuations, selectedHorseId, selectHorse, addValuation, addResults } = useAppStore();
  const [manualResults, setManualResults] = useState<Partial<CompetitionResult>[]>([]);
  const [loading, setLoading] = useState(false);

  const horse = horses.find((h) => h.id === selectedHorseId) ?? horses[0];
  const horseResults = results.filter((r) => r.horseId === horse?.id);
  const latestValuation = valuations.find((v) => v.horseId === horse?.id);

  useEffect(() => {
    if (horse && !selectedHorseId) selectHorse(horse.id);
  }, [horse, selectedHorseId, selectHorse]);

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

  if (horses.length === 0) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#888888' }}>
        <div style={{ fontSize: 40 }}>🐎</div>
        <p>Primero agrega un caballo en la sección <strong style={{ color: '#111111' }}>Discover</strong>.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', maxWidth: 900 }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, color: '#111111', letterSpacing: '-0.5px' }}>Valoración</h1>
      <p style={{ margin: '0 0 28px', color: '#888888', fontSize: 14 }}>Genera una valoración AI basada en performance, linaje y mercado.</p>

      {/* Horse selector */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        {horses.map((h) => (
          <button
            key={h.id}
            onClick={() => selectHorse(h.id)}
            style={{
              background: selectedHorseId === h.id || (!selectedHorseId && h.id === horse?.id) ? '#111111' : '#FFFFFF',
              color: selectedHorseId === h.id || (!selectedHorseId && h.id === horse?.id) ? '#FFFFFF' : '#888888',
              border: '1px solid #E8E8E8', borderRadius: 20,
              padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}
          >
            {h.name} · {h.age}y
          </button>
        ))}
      </div>

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
