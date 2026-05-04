import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, ChevronLeft, ChevronRight, Trophy, Calendar, MapPin, User, ExternalLink } from 'lucide-react';
import { serverListHorses } from '../services/serverDB';
import type { DBHorse, DBResult } from '../types';

const FLAG: Record<string, string> = {
  BEL:'🇧🇪',USA:'🇺🇸',FRA:'🇫🇷',NED:'🇳🇱',GER:'🇩🇪',BRA:'🇧🇷',ESP:'🇪🇸',GBR:'🇬🇧',
  IRL:'🇮🇪',AUS:'🇦🇺',SAU:'🇸🇦',SUI:'🇨🇭',SWE:'🇸🇪',DEN:'🇩🇰',NOR:'🇳🇴',POL:'🇵🇱',
  CZE:'🇨🇿',AUT:'🇦🇹',ITA:'🇮🇹',POR:'🇵🇹',ARG:'🇦🇷',URU:'🇺🇾',CHI:'🇨🇱',MEX:'🇲🇽',
  CAN:'🇨🇦',CHN:'🇨🇳',QAT:'🇶🇦',UAE:'🇦🇪',JPN:'🇯🇵',RSA:'🇿🇦',
};
const flag = (c?: string | null) => (c ? FLAG[c.toUpperCase()] ?? c : '—');
const genderLabel = (g?: string | null) =>
  g === 'stallion' ? 'Macho' : g === 'mare' ? 'Yegua' : g === 'gelding' ? 'Castrado' : g ?? '—';
const GENDER_COLOR: Record<string, string> = { stallion: '#3B82F6', mare: '#EC4899', gelding: '#8B5CF6' };
const GENDER_BG:    Record<string, string> = { stallion: 'rgba(59,130,246,0.08)', mare: 'rgba(236,72,153,0.08)', gelding: 'rgba(139,92,246,0.08)' };

const LIMIT = 50;
const COUNTRIES = ['','ARG','URU','CHI','BRA','MEX','BEL','NED','GER','FRA','GBR','IRL','USA','SUI','SWE','DEN','NOR','AUT','ITA','ESP','POR','AUS','QAT','SAU'];

export default function HorsesPage() {
  const [horses, setHorses]       = useState<DBHorse[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [q, setQ]                 = useState('');
  const [country, setCountry]     = useState('');
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [selected, setSelected]   = useState<DBHorse | null>(null);
  const [results, setResults]     = useState<DBResult[]>([]);
  const [loadingRes, setLoadingRes] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openHorse = async (h: DBHorse) => {
    setSelected(h);
    setLoadingRes(true);
    try {
      const res = await fetch(`/api/results?horseId=${encodeURIComponent(h.id)}`);
      const data = await res.json() as DBResult[];
      setResults(data.sort((a, b) => b.eventDate.localeCompare(a.eventDate)));
    } catch { setResults([]); }
    finally { setLoadingRes(false); }
  };

  const load = useCallback(async (pg: number, query: string, ctry: string) => {
    setLoading(true); setError(null);
    try {
      const res = await serverListHorses({ page: pg, limit: LIMIT, q: query || undefined, country: ctry || undefined });
      setHorses(res.data); setTotal(res.total);
    } catch { setError('No se pudo conectar a la API.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(1, '', ''); }, [load]);

  const handleSearch = (val: string) => {
    setQ(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); load(1, val, country); }, 300);
  };
  const handleCountry = (val: string) => { setCountry(val); setPage(1); load(1, q, val); };
  const goPage = (pg: number) => { setPage(pg); load(pg, q, country); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const totalPages = Math.ceil(total / LIMIT);

  return (
    <>
    <div className="page-pad" style={{ padding: '32px', background: '#F6F9FC', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 className="page-h1" style={{ margin: '0 0 4px', fontSize: 24, fontWeight: 800, color: '#0A2540', letterSpacing: '-0.4px' }}>Caballos</h1>
        <p style={{ margin: 0, color: '#697386', fontSize: 14 }}>
          {total > 0 ? `${total.toLocaleString('es-AR')} caballos en la base de datos` : loading ? 'Cargando…' : '0 caballos'}
        </p>
      </div>

      {/* Search bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#A3ACBA', pointerEvents: 'none' }} />
          <input
            value={q}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar por nombre…"
            className="ev-input"
            style={{ width: '100%', paddingLeft: 34, paddingRight: q ? 32 : 12, paddingTop: 9, paddingBottom: 9, fontSize: 14, boxSizing: 'border-box' }}
          />
          {q && (
            <button onClick={() => handleSearch('')} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#A3ACBA', padding: 2, lineHeight: 0 }}>
              <X size={13} />
            </button>
          )}
        </div>
        <select value={country} onChange={(e) => handleCountry(e.target.value)} className="ev-input" style={{ padding: '9px 12px', fontSize: 14, cursor: 'pointer' }}>
          <option value="">Todos los países</option>
          {COUNTRIES.filter(Boolean).map((c) => <option key={c} value={c}>{flag(c)} {c}</option>)}
        </select>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(229,72,59,0.06)', border: '1px solid rgba(229,72,59,0.2)', borderRadius: 8, color: '#E5483B', fontSize: 13, marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ background: '#FFFFFF', border: '1px solid #E3E8EF', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', minWidth: 560 }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 110px 1fr 1fr 1fr', padding: '9px 18px', background: '#F8FAFC', borderBottom: '1px solid #E3E8EF' }}>
          {['Nombre', 'País', 'Género', 'Padre', 'Madre', 'Studbook'].map((h) => (
            <div key={h} style={{ fontSize: 10, fontWeight: 700, color: '#A3ACBA', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: '#A3ACBA', fontSize: 14 }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>🏇</div>Cargando caballos…
          </div>
        ) : horses.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: '#A3ACBA' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🐎</div>No se encontraron caballos
          </div>
        ) : horses.map((h) => (
          <div key={h.id}
            className="ev-tr-hover"
            onClick={() => openHorse(h)}
            style={{ display: 'grid', gridTemplateColumns: '2fr 80px 110px 1fr 1fr 1fr', padding: '11px 18px', borderBottom: '1px solid #F0F4F8', alignItems: 'center', cursor: 'pointer' }}
          >
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#0A2540' }}>{h.name}</div>
              {h.birthYear && <div style={{ fontSize: 11, color: '#A3ACBA', marginTop: 1 }}>{new Date().getFullYear() - h.birthYear}a · {h.birthYear}</div>}
            </div>
            <div style={{ fontSize: 13, color: '#697386' }}>{flag(h.countryCode)} {h.countryCode || '—'}</div>
            <div>
              {h.gender ? (
                <span style={{ background: GENDER_BG[h.gender] ?? '#F6F9FC', color: GENDER_COLOR[h.gender] ?? '#697386', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                  {genderLabel(h.gender)}
                </span>
              ) : <span style={{ color: '#A3ACBA', fontSize: 13 }}>—</span>}
            </div>
            <div style={{ fontSize: 12.5, color: '#697386', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.sire || '—'}</div>
            <div style={{ fontSize: 12.5, color: '#697386', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.dam || '—'}</div>
            <div style={{ fontSize: 11.5, color: '#A3ACBA', fontWeight: 500 }}>{h.studbook || '—'}</div>
          </div>
        ))}
      </div>
      </div>{/* end scroll wrapper */}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          <div style={{ fontSize: 13, color: '#A3ACBA' }}>
            Página {page} de {totalPages} · {total.toLocaleString('es-AR')} total
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <PBtn disabled={page <= 1} onClick={() => goPage(page - 1)}><ChevronLeft size={15} /></PBtn>
            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
              let pg: number;
              if (totalPages <= 7) pg = i + 1;
              else if (page <= 4) pg = i + 1;
              else if (page >= totalPages - 3) pg = totalPages - 6 + i;
              else pg = page - 3 + i;
              return <PBtn key={pg} active={pg === page} onClick={() => goPage(pg)}>{pg}</PBtn>;
            })}
            <PBtn disabled={page >= totalPages} onClick={() => goPage(page + 1)}><ChevronRight size={15} /></PBtn>
          </div>
        </div>
      )}
    </div>

    {/* ── Horse Detail Modal ─────────────────────────────────────────── */}
    {selected && (
      <div
        onClick={() => setSelected(null)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(10,37,64,0.45)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0 0 0' }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ background: '#FFFFFF', borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 680, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 -4px 32px rgba(0,0,0,0.15)' }}
        >
          {/* Modal header */}
          <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E3E8EF', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 22, fontFamily: 'serif' }}>♞</span>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#0A2540', letterSpacing: '-0.3px' }}>{selected.name}</h2>
                {selected.feiId && (
                  <a href={`https://www.fei.org/horse/${selected.feiId}/results`} target="_blank" rel="noreferrer"
                    style={{ color: '#635BFF', fontSize: 12, display: 'flex', alignItems: 'center', gap: 3, textDecoration: 'none', fontWeight: 600 }}
                    onClick={(e) => e.stopPropagation()}>
                    FEI <ExternalLink size={11} />
                  </a>
                )}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {selected.feiId && <Chip>{selected.feiId}</Chip>}
                {selected.countryCode && <Chip>{flag(selected.countryCode)} {selected.countryCode}</Chip>}
                {selected.birthYear && <Chip>🗓 {selected.birthYear} ({new Date().getFullYear() - selected.birthYear} años)</Chip>}
                {selected.gender && <Chip color={GENDER_COLOR[selected.gender]}>{genderLabel(selected.gender)}</Chip>}
                {selected.breed && <Chip>{selected.breed}</Chip>}
                {selected.color && <Chip>🎨 {selected.color}</Chip>}
              </div>
            </div>
            <button onClick={() => setSelected(null)} style={{ background: '#F0F4F8', border: 'none', borderRadius: 8, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <X size={16} color="#697386" />
            </button>
          </div>

          {/* Pedigree */}
          <div style={{ padding: '14px 24px', borderBottom: '1px solid #F0F4F8', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            {selected.sire && <div><div style={{ fontSize: 10, fontWeight: 700, color: '#A3ACBA', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>Padre</div><div style={{ fontSize: 13.5, fontWeight: 600, color: '#0A2540' }}>{selected.sire}</div></div>}
            {selected.dam && <div><div style={{ fontSize: 10, fontWeight: 700, color: '#A3ACBA', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>Madre</div><div style={{ fontSize: 13.5, fontWeight: 600, color: '#0A2540' }}>{selected.dam}</div></div>}
            {selected.damSire && <div><div style={{ fontSize: 10, fontWeight: 700, color: '#A3ACBA', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>Abuelo materno</div><div style={{ fontSize: 13.5, fontWeight: 600, color: '#0A2540' }}>{selected.damSire}</div></div>}
            {selected.currentRider && <div><div style={{ fontSize: 10, fontWeight: 700, color: '#A3ACBA', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>Jinete</div><div style={{ fontSize: 13.5, fontWeight: 600, color: '#0A2540' }}>{selected.currentRider}</div></div>}
          </div>

          {/* Results */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 env(safe-area-inset-bottom)' }}>
            <div style={{ padding: '12px 24px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0A2540', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Resultados FEI
              </div>
              {!loadingRes && results.length > 0 && (
                <div style={{ fontSize: 12, color: '#697386' }}>
                  {results.length} starts · {results.filter(r => r.placement === 1).length} victoria{results.filter(r => r.placement === 1).length !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            {loadingRes ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#A3ACBA', fontSize: 13 }}>Cargando resultados…</div>
            ) : results.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: '#A3ACBA', fontSize: 13 }}>Sin resultados registrados</div>
            ) : (
              <div style={{ padding: '0 16px 16px' }}>
                {results.map((r) => {
                  const isWin = r.placement === 1;
                  const isTop3 = r.placement != null && r.placement <= 3;
                  return (
                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, marginBottom: 2, background: isWin ? 'rgba(99,91,255,0.05)' : 'transparent', border: isWin ? '1px solid rgba(99,91,255,0.15)' : '1px solid transparent' }}>
                      {/* Position badge */}
                      <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        background: isWin ? '#635BFF' : isTop3 ? 'rgba(48,181,124,0.12)' : '#F0F4F8',
                        color: isWin ? '#fff' : isTop3 ? '#30B57C' : '#A3ACBA',
                        fontSize: isWin ? 14 : 12, fontWeight: 700 }}>
                        {isWin ? <Trophy size={14} /> : r.placement ?? '—'}
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#0A2540' }}>{r.eventName}</span>
                          <span style={{ fontSize: 11, background: '#F0F4F8', color: '#697386', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>{r.level}</span>
                          {r.category && <span style={{ fontSize: 11, color: '#A3ACBA' }}>{r.category}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                          <span style={{ fontSize: 11, color: '#A3ACBA', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Calendar size={10} />{r.eventDate}
                          </span>
                          {r.riderName && (
                            <span style={{ fontSize: 11, color: '#A3ACBA', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <User size={10} />{r.riderName}
                            </span>
                          )}
                          {r.eventCountry && (
                            <span style={{ fontSize: 11, color: '#A3ACBA', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <MapPin size={10} />{r.eventCountry}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function PBtn({ children, onClick, disabled, active }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; active?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className={active ? 'ev-btn-gold' : 'ev-btn-ghost'} style={{
      width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 7, padding: 0,
      cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.35 : 1,
      fontSize: 13, fontWeight: active ? 700 : 500,
    }}>
      {children}
    </button>
  );
}

function Chip({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, background: color ? `${color}18` : '#F0F4F8', color: color ?? '#697386', borderRadius: 6, padding: '3px 8px' }}>
      {children}
    </span>
  );
}