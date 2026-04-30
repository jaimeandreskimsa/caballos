import { useState } from 'react';
import { searchFeiHorse, getFeiHorseResults, searchJumprHorse } from '../services/scrapers';
import { useAppStore } from '../store/appStore';
import type { Horse } from '../types';
import { Search, Download, ExternalLink } from 'lucide-react';

interface FeiResult { feiId: string; name: string; birthYear?: number; countryCode?: string; }

export default function SearchPage() {
  const { addHorse, addResults, horses } = useAppStore();
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<'FEI' | 'JUMPR'>('FEI');
  const [feiResults, setFeiResults] = useState<FeiResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setFeiResults([]);
    setMessage('');
    try {
      const results = source === 'FEI'
        ? await searchFeiHorse(query)
        : await searchJumprHorse(query);
      setFeiResults(results);
      if (results.length === 0) setMessage('Sin resultados. Prueba con otro nombre o fuente.');
    } catch {
      setMessage('Error al conectar con la API. Verifica tu conexión.');
    }
    setLoading(false);
  };

  const handleImport = async (fr: FeiResult) => {
    setImporting(fr.feiId);
    const existingHorse = horses.find((h) => h.feiId === fr.feiId);
    let horseId = existingHorse?.id;

    if (!existingHorse) {
      const horse: Horse = {
        id: crypto.randomUUID(),
        feiId: fr.feiId,
        name: fr.name,
        age: fr.birthYear ? new Date().getFullYear() - fr.birthYear : 8,
        breed: '',
        gender: 'gelding',
        country: fr.countryCode ?? '',
        studbook: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addHorse(horse);
      horseId = horse.id;
    }

    // Fetch results from FEI
    const results = await getFeiHorseResults(fr.feiId);
    if (results.length > 0 && horseId) {
      const mapped = results.map((r) => ({ ...r, horseId: horseId! }));
      addResults(mapped);
      setMessage(`✅ Importados ${results.length} resultados para ${fr.name}`);
    } else {
      setMessage(`⚠️ Caballo importado sin resultados (FEI puede requerir autenticación).`);
    }

    setImporting(null);
  };

  return (
    <div style={{ padding: 32, maxWidth: 800 }}>
      <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 800, color: '#111111', letterSpacing: '-0.5px' }}>Buscar en FEI / Jumpr</h1>
      <p style={{ margin: '0 0 28px', color: '#888888', fontSize: 14 }}>
        Busca caballos en bases de datos externas e importa sus resultados.
      </p>

      {/* Source selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['FEI', 'JUMPR'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSource(s)}
            style={{
              background: source === s ? '#111111' : '#FFFFFF',
              color: source === s ? '#FFFFFF' : '#888888',
              border: '1px solid #E8E8E8', borderRadius: 20,
              padding: '7px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}
          >
            {s === 'FEI' ? '🌍 FEI' : '⚡ Jumpr'}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Nombre del caballo (ej: Nonstop, Chacco-Blue...)"
          style={{
            flex: 1, background: '#FFFFFF', border: '1px solid #E8E8E8', color: '#111111',
            borderRadius: 10, padding: '11px 16px', fontSize: 14, outline: 'none', fontFamily: 'inherit',
          }}
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          style={{
            background: '#111111', color: '#FFFFFF', border: 'none',
            borderRadius: 10, padding: '0 20px', fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, fontSize: 14,
          }}
        >
          <Search size={15} /> {loading ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {message && (
        <div style={{
          background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: 10,
          padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#0369A1',
        }}>
          {message}
        </div>
      )}

      {/* Results */}
      {feiResults.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {feiResults.map((r) => {
            const alreadyIn = horses.some((h) => h.feiId === r.feiId);
            return (
              <div key={r.feiId} style={{
                background: '#FFFFFF', border: '1px solid #EBEBEB', borderRadius: 12,
                padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#111111' }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: '#888888', marginTop: 3 }}>
                    FEI ID: {r.feiId}
                    {r.birthYear && ` · Nacido: ${r.birthYear}`}
                    {r.countryCode && ` · ${r.countryCode}`}
                    {alreadyIn && <span style={{ color: '#22C55E', marginLeft: 8 }}>✓ En tu portafolio</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <a
                    href={`https://data.fei.org/Horse/${r.feiId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#AAAAAA', display: 'flex', alignItems: 'center' }}
                  >
                    <ExternalLink size={14} />
                  </a>
                  <button
                    onClick={() => handleImport(r)}
                    disabled={importing === r.feiId}
                    style={{
                      background: alreadyIn ? '#F0FDF4' : '#FAFAFA',
                      color: alreadyIn ? '#22C55E' : '#111111',
                      border: `1px solid ${alreadyIn ? '#BBF7D0' : '#E8E8E8'}`,
                      borderRadius: 8, padding: '6px 14px', fontSize: 12,
                      fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                    }}
                  >
                    <Download size={12} />
                    {importing === r.feiId ? 'Importando...' : alreadyIn ? 'Actualizar' : 'Importar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FEI info note */}
      <div style={{
        marginTop: 32, background: '#FAFAFA', border: '1px solid #EBEBEB',
        borderRadius: 12, padding: '16px 20px', fontSize: 12, color: '#888888', lineHeight: 1.6,
      }}>
        <strong style={{ color: '#555555' }}>ℹ️ Fuentes de datos</strong>
        <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
          <li><strong style={{ color: '#111111' }}>FEI</strong> — data.fei.org · Rankings, resultados globales, perfiles de caballos</li>
          <li><strong style={{ color: '#111111' }}>Jumpr</strong> — jum.pr · Stats detallados, % clear rounds, podiums</li>
          <li>Algunas APIs requieren autenticación — en ese caso agrega resultados manualmente en Valoración.</li>
        </ul>
      </div>
    </div>
  );
}
