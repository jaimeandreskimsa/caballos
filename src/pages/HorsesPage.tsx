import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { serverListHorses } from '../services/serverDB';
import type { DBHorse } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const FLAG: Record<string, string> = {
  BEL: '🇧🇪', USA: '🇺🇸', FRA: '🇫🇷', NED: '🇳🇱', GER: '🇩🇪',
  BRA: '🇧🇷', ESP: '🇪🇸', GBR: '🇬🇧', IRL: '🇮🇪', AUS: '🇦🇺',
  SAU: '🇸🇦', SUI: '🇨🇭', SWE: '🇸🇪', DEN: '🇩🇰', NOR: '🇳🇴',
  POL: '🇵🇱', CZE: '🇨🇿', AUT: '🇦🇹', ITA: '🇮🇹', POR: '🇵🇹',
  ARG: '🇦🇷', URU: '🇺🇾', CHI: '🇨🇱', MEX: '🇲🇽', CAN: '🇨🇦',
  CHN: '🇨🇳', QAT: '🇶🇦', UAE: '🇦🇪', JPN: '🇯🇵', RSA: '🇿🇦',
};
const flag = (c?: string | null) => (c ? FLAG[c.toUpperCase()] ?? c : '—');
const genderLabel = (g?: string | null) =>
  g === 'stallion' ? 'Macho' : g === 'mare' ? 'Yegua' : g === 'gelding' ? 'Castrado' : g ?? '—';

const LIMIT = 50;
const COUNTRIES = ['','ARG','URU','CHI','BRA','MEX','BEL','NED','GER','FRA','GBR','IRL','USA','SUI','SWE','DEN','NOR','AUT','ITA','ESP','POR','AUS','QAT','SAU'];

export default function HorsesPage() {
  const [horses, setHorses]   = useState<DBHorse[]>([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [q, setQ]             = useState('');
  const [country, setCountry] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (pg: number, query: string, ctry: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await serverListHorses({ page: pg, limit: LIMIT, q: query || undefined, country: ctry || undefined });
      setHorses(res.data);
      setTotal(res.total);
    } catch {
      setError('No se pudo conectar a la API. ¿Está corriendo el servidor?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1, '', ''); }, [load]);

  const handleSearch = (val: string) => {
    setQ(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      load(1, val, country);
    }, 300);
  };

  const handleCountry = (val: string) => {
    setCountry(val);
    setPage(1);
    load(1, q, val);
  };

  const goPage = (pg: number) => {
    setPage(pg);
    load(pg, q, country);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#111111', letterSpacing: '-0.5px' }}>Caballos</h1>
        <p style={{ margin: '4px 0 0', color: '#888888', fontSize: 14 }}>
          {total > 0 ? `${total.toLocaleString('es-AR')} caballos en la base de datos` : loading ? 'Cargando…' : '0 caballos'}
        </p>
      </div>

      {/* Search + filter bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#AAAAAA', pointerEvents: 'none' }} />
          <input
            value={q}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar por nombre…"
            style={{
              width: '100%', paddingLeft: 36, paddingRight: q ? 32 : 12,
              paddingTop: 10, paddingBottom: 10,
              border: '1px solid #E0E0E0', borderRadius: 10,
              fontSize: 14, color: '#111111', background: '#FFFFFF',
              outline: 'none', boxSizing: 'border-box',
            }}
          />
          {q && (
            <button onClick={() => handleSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#AAAAAA', padding: 2 }}>
              <X size={14} />
            </button>
          )}
        </div>
        <select
          value={country}
          onChange={(e) => handleCountry(e.target.value)}
          style={{ padding: '10px 14px', border: '1px solid #E0E0E0', borderRadius: 10, fontSize: 14, color: '#111111', background: '#FFFFFF', cursor: 'pointer', outline: 'none' }}
        >
          <option value="">Todos los países</option>
          {COUNTRIES.filter(Boolean).map((c) => <option key={c} value={c}>{flag(c)} {c}</option>)}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '16px 20px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, color: '#DC2626', fontSize: 14, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#FFFFFF', border: '1px solid #EBEBEB', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 100px 1fr 1fr 1fr', padding: '10px 16px', background: '#FAFAFA', borderBottom: '1px solid #F0F0F0' }}>
          {['Nombre', 'País', 'Género', 'Padre', 'Madre', 'Studbook'].map((h) => (
            <div key={h} style={{ fontSize: 11, fontWeight: 600, color: '#AAAAAA', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: '#AAAAAA', fontSize: 14 }}>Cargando caballos…</div>
        ) : horses.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: '#AAAAAA' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🐎</div>
            No se encontraron caballos
          </div>
        ) : horses.map((h) => (
          <div key={h.id} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 100px 1fr 1fr 1fr', padding: '11px 16px', borderBottom: '1px solid #F5F5F5', transition: 'background 0.1s' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#FAFAFA')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111111' }}>{h.name}</div>
              {h.birthYear && <div style={{ fontSize: 11, color: '#AAAAAA' }}>{new Date().getFullYear() - h.birthYear} años · {h.birthYear}</div>}
            </div>
            <div style={{ fontSize: 13, color: '#555555' }}>{flag(h.countryCode)} {h.countryCode || '—'}</div>
            <div style={{ fontSize: 13, color: '#555555' }}>{genderLabel(h.gender)}</div>
            <div style={{ fontSize: 13, color: '#555555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.sire || '—'}</div>
            <div style={{ fontSize: 13, color: '#555555', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.dam || '—'}</div>
            <div style={{ fontSize: 13, color: '#888888' }}>{h.studbook || '—'}</div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }}>
          <div style={{ fontSize: 13, color: '#888888' }}>Página {page} de {totalPages} · {total.toLocaleString('es-AR')} total</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <PBtn disabled={page <= 1} onClick={() => goPage(page - 1)}><ChevronLeft size={16} /></PBtn>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let pg: number;
              if (totalPages <= 7) pg = i + 1;
              else if (page <= 4) pg = i + 1;
              else if (page >= totalPages - 3) pg = totalPages - 6 + i;
              else pg = page - 3 + i;
              return <PBtn key={pg} active={pg === page} onClick={() => goPage(pg)}>{pg}</PBtn>;
            })}
            <PBtn disabled={page >= totalPages} onClick={() => goPage(page + 1)}><ChevronRight size={16} /></PBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function PBtn({ children, onClick, disabled, active }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 8, border: '1px solid #E0E0E0', cursor: disabled ? 'default' : 'pointer',
      background: active ? '#111111' : '#FFFFFF',
      color: active ? '#FFFFFF' : disabled ? '#CCCCCC' : '#444444',
      fontSize: 13, fontWeight: active ? 700 : 400,
    }}>
      {children}
    </button>
  );
}
