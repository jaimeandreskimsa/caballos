import { useState } from 'react';
import { Download, AlertCircle, CheckCircle, ExternalLink, Loader } from 'lucide-react';

const FLAG: Record<string, string> = {
  ARG:'🇦🇷',BRA:'🇧🇷',URU:'🇺🇾',CHI:'🇨🇱',MEX:'🇲🇽',PAR:'🇵🇾',BOL:'🇧🇴',COL:'🇨🇴',
  PER:'🇵🇪',VEN:'🇻🇪',USA:'🇺🇸',CAN:'🇨🇦',GBR:'🇬🇧',GER:'🇩🇪',FRA:'🇫🇷',ESP:'🇪🇸',
  ITA:'🇮🇹',BEL:'🇧🇪',NED:'🇳🇱',SUI:'🇨🇭',IRL:'🇮🇪',SWE:'🇸🇪',DEN:'🇩🇰',NOR:'🇳🇴',
};

const COUNTRIES = [
  'ARG','BRA','URU','CHI','MEX','PAR','BOL','COL','PER','VEN',
  'USA','CAN','GBR','GER','FRA','ESP','ITA','BEL','NED','SUI','IRL','SWE','DEN','NOR',
];

interface ImportResult {
  ok?: boolean;
  error?: string;
  horse?: { id: string; name: string; feiId: string; country: string; starts?: number; wins?: number };
  resultsImported?: number;
  resultsOnPage?: number;
  note?: string | null;
}

interface BatchItem {
  feiId: string;
  country: string;
  status: 'pending' | 'loading' | 'done' | 'error';
  result?: ImportResult;
}

export default function ImportPage() {
  const [feiId, setFeiId]     = useState('');
  const [country, setCountry] = useState('ARG');
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<ImportResult | null>(null);

  // Batch import
  const [batchText, setBatchText] = useState('');
  const [batch, setBatch]         = useState<BatchItem[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);

  const importSingle = async (id = feiId, cc = country): Promise<ImportResult> => {
    const res = await fetch('/api/import/fei', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feiId: id.trim().toUpperCase(), country: cc }),
    });
    return res.json();
  };

  const handleSingle = async () => {
    if (!feiId.trim()) return;
    setLoading(true);
    setResult(null);
    const r = await importSingle();
    setResult(r);
    setLoading(false);
  };

  const parseBatch = () => {
    const lines = batchText.trim().split('\n').map(l => l.trim()).filter(Boolean);
    const items: BatchItem[] = lines.map(line => {
      // Format: "108MV97 ARG" or "108MV97,ARG" or just "108MV97"
      const parts = line.split(/[\s,]+/);
      return { feiId: parts[0]?.toUpperCase() ?? '', country: parts[1]?.toUpperCase() ?? 'ARG', status: 'pending' as const };
    }).filter(i => i.feiId);
    setBatch(items);
  };

  const runBatch = async () => {
    setBatchRunning(true);
    for (let i = 0; i < batch.length; i++) {
      setBatch(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'loading' } : item));
      const result = await importSingle(batch[i].feiId, batch[i].country);
      setBatch(prev => prev.map((item, idx) =>
        idx === i ? { ...item, status: result.ok ? 'done' : 'error', result } : item
      ));
      await new Promise(r => setTimeout(r, 1500)); // polite delay
    }
    setBatchRunning(false);
  };

  return (
    <div style={{ padding: '32px 24px', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0A2540', marginBottom: 4 }}>
        Importar desde FEI
      </h1>
      <p style={{ color: '#697386', fontSize: 14, marginBottom: 32 }}>
        Ingresa el FEI ID de un caballo para importar su información y resultados a la base de datos.{' '}
        <a href="https://www.fei.org/horses" target="_blank" rel="noreferrer" style={{ color: '#635BFF' }}>
          Buscar IDs en FEI.org <ExternalLink size={12} style={{ verticalAlign: 'middle' }} />
        </a>
      </p>

      {/* ── Single import ── */}
      <div style={{ background: '#fff', border: '1px solid #E3E8EF', borderRadius: 12, padding: 24, marginBottom: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#0A2540', marginBottom: 16 }}>Importar un caballo</h2>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#697386', marginBottom: 6 }}>FEI ID</label>
            <input
              value={feiId}
              onChange={e => setFeiId(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleSingle()}
              placeholder="108MV97"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1.5px solid #E3E8EF', fontSize: 14, outline: 'none',
                fontFamily: 'monospace', letterSpacing: 1,
              }}
            />
          </div>

          <div style={{ minWidth: 120 }}>
            <label style={{ display: 'block', fontSize: 12, color: '#697386', marginBottom: 6 }}>País</label>
            <select
              value={country}
              onChange={e => setCountry(e.target.value)}
              style={{
                padding: '10px 14px', borderRadius: 8,
                border: '1.5px solid #E3E8EF', fontSize: 14, background: '#fff',
              }}
            >
              {COUNTRIES.map(c => (
                <option key={c} value={c}>{FLAG[c] ?? ''} {c}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={handleSingle}
              disabled={loading || !feiId.trim()}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 8, border: 'none',
                background: loading || !feiId.trim() ? '#E3E8EF' : '#635BFF',
                color: loading || !feiId.trim() ? '#697386' : '#fff',
                fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}
            >
              {loading ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={16} />}
              {loading ? 'Importando…' : 'Importar'}
            </button>
          </div>
        </div>

        {/* FEI link preview */}
        {feiId.trim() && (
          <p style={{ fontSize: 12, color: '#697386' }}>
            Ver en FEI:{' '}
            <a
              href={`https://www.fei.org/horse/${feiId.trim()}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#635BFF' }}
            >
              fei.org/horse/{feiId.trim()} <ExternalLink size={11} style={{ verticalAlign: 'middle' }} />
            </a>
          </p>
        )}

        {/* Result */}
        {result && (
          <div style={{
            marginTop: 16, padding: 16, borderRadius: 8,
            background: result.ok ? 'rgba(48,181,124,0.08)' : 'rgba(229,72,59,0.08)',
            border: `1px solid ${result.ok ? 'rgba(48,181,124,0.3)' : 'rgba(229,72,59,0.3)'}`,
          }}>
            {result.ok ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <CheckCircle size={18} color="#30B57C" />
                  <span style={{ fontWeight: 600, color: '#0A2540' }}>
                    {result.horse?.name} importado correctamente
                  </span>
                </div>
                <div style={{ fontSize: 13, color: '#4A5568', display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                  <span>ID: <code style={{ fontFamily: 'monospace', color: '#635BFF' }}>{result.horse?.id}</code></span>
                  {result.horse?.starts && <span>{result.horse.starts} starts, {result.horse.wins ?? 0} wins (FEI)</span>}
                  <span>{result.resultsImported} resultados importados</span>
                </div>
                {result.note && (
                  <p style={{ marginTop: 8, fontSize: 12, color: '#697386' }}>
                    ⚠ {result.note}
                  </p>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={18} color="#E5483B" />
                <span style={{ color: '#E5483B', fontSize: 14 }}>{result.error}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Batch import ── */}
      <div style={{ background: '#fff', border: '1px solid #E3E8EF', borderRadius: 12, padding: 24 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#0A2540', marginBottom: 8 }}>Importar varios caballos</h2>
        <p style={{ fontSize: 13, color: '#697386', marginBottom: 12 }}>
          Un caballo por línea. Formato: <code style={{ fontFamily: 'monospace', background: '#F6F9FC', padding: '1px 6px', borderRadius: 4 }}>FEI_ID PAIS</code>
        </p>

        <textarea
          value={batchText}
          onChange={e => setBatchText(e.target.value)}
          placeholder={'108MV97 ARG\n109JG09 BRA\n107AB12 URU'}
          rows={5}
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 8,
            border: '1.5px solid #E3E8EF', fontSize: 13, fontFamily: 'monospace',
            resize: 'vertical', outline: 'none', boxSizing: 'border-box',
          }}
        />

        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button
            onClick={parseBatch}
            disabled={!batchText.trim()}
            style={{
              padding: '9px 18px', borderRadius: 8, border: '1.5px solid #E3E8EF',
              background: '#fff', color: '#0A2540', fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}
          >
            Previsualizar
          </button>
          <button
            onClick={runBatch}
            disabled={batch.length === 0 || batchRunning}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 18px', borderRadius: 8, border: 'none',
              background: batch.length === 0 || batchRunning ? '#E3E8EF' : '#635BFF',
              color: batch.length === 0 || batchRunning ? '#697386' : '#fff',
              fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}
          >
            {batchRunning ? <Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={15} />}
            {batchRunning ? 'Importando…' : `Importar ${batch.length > 0 ? batch.length : ''}`}
          </button>
        </div>

        {/* Batch list */}
        {batch.length > 0 && (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {batch.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 12px', borderRadius: 8, background: '#F6F9FC',
                border: '1px solid #E3E8EF',
              }}>
                <code style={{ fontFamily: 'monospace', fontSize: 13, color: '#635BFF', minWidth: 90 }}>
                  {item.feiId}
                </code>
                <span style={{ fontSize: 12, color: '#697386', minWidth: 40 }}>
                  {FLAG[item.country] ?? ''} {item.country}
                </span>
                <div style={{ flex: 1, fontSize: 12, color: '#4A5568' }}>
                  {item.result?.horse?.name ?? ''}
                  {item.result?.resultsImported != null && ` — ${item.result.resultsImported} resultados`}
                  {item.result?.error && <span style={{ color: '#E5483B' }}>{item.result.error}</span>}
                </div>
                <span style={{ fontSize: 12, color: statusColor(item.status) }}>
                  {statusLabel(item.status)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Spin animation */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function statusColor(s: BatchItem['status']) {
  return s === 'done' ? '#30B57C' : s === 'error' ? '#E5483B' : s === 'loading' ? '#635BFF' : '#697386';
}
function statusLabel(s: BatchItem['status']) {
  return s === 'done' ? '✓ Importado' : s === 'error' ? '✗ Error' : s === 'loading' ? '…' : 'Pendiente';
}
