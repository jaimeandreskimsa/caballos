import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Trophy, Calendar, MapPin, User } from 'lucide-react';
import type { DBHorse, DBResult } from '../types';

const FLAG: Record<string, string> = {
  BEL:'🇧🇪',USA:'🇺🇸',FRA:'🇫🇷',NED:'🇳🇱',GER:'🇩🇪',BRA:'🇧🇷',ESP:'🇪🇸',GBR:'🇬🇧',
  IRL:'🇮🇪',AUS:'🇦🇺',SAU:'🇸🇦',SUI:'🇨🇭',SWE:'🇸🇪',DEN:'🇩🇰',NOR:'🇳🇴',POL:'🇵🇱',
  CZE:'🇨🇿',AUT:'🇦🇹',ITA:'🇮🇹',POR:'🇵🇹',ARG:'🇦🇷',URU:'🇺🇾',CHI:'🇨🇱',MEX:'🇲🇽',
  CAN:'🇨🇦',CHN:'🇨🇳',QAT:'🇶🇦',UAE:'🇦🇪',JPN:'🇯🇵',RSA:'🇿🇦',
};
const flag = (c?: string | null) => (c ? FLAG[c.toUpperCase()] ?? c : '—');
const genderLabel = (g?: string | null) =>
  g === 'stallion' ? 'Macho entero' : g === 'mare' ? 'Yegua' : g === 'gelding' ? 'Castrado' : g ?? '—';
const GENDER_COLOR: Record<string, string> = { stallion: '#3B82F6', mare: '#EC4899', gelding: '#8B5CF6' };

function Chip({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      fontSize: 12, fontWeight: 600,
      background: color ? `${color}15` : '#F0F4F8',
      color: color ?? '#697386',
      borderRadius: 7, padding: '4px 10px',
      display: 'inline-flex', alignItems: 'center', gap: 4,
      border: `1px solid ${color ? `${color}25` : '#E3E8EF'}`,
    }}>
      {children}
    </span>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div style={{
      background: accent ? 'rgba(99,91,255,0.06)' : '#FFFFFF',
      border: `1px solid ${accent ? 'rgba(99,91,255,0.2)' : '#E3E8EF'}`,
      borderRadius: 12, padding: '16px 20px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent ? '#635BFF' : '#0A2540', letterSpacing: '-0.5px' }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: '#0A2540', fontWeight: 700, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
    </div>
  );
}

export default function HorseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [horse, setHorse] = useState<DBHorse | null>(null);
  const [results, setResults] = useState<DBResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/horses/${encodeURIComponent(id)}`).then(r => r.ok ? r.json() : null),
      fetch(`/api/results?horseId=${encodeURIComponent(id)}`).then(r => r.ok ? r.json() : []),
    ]).then(([h, res]) => {
      setHorse(h);
      setResults((res as DBResult[]).sort((a, b) => b.eventDate.localeCompare(a.eventDate)));
    }).catch(() => setError('No se pudo cargar la información del caballo.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ color: '#A3ACBA', fontSize: 14 }}>Cargando…</div>
    </div>
  );

  if (error || !horse) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ color: '#E5483B', marginBottom: 16 }}>{error ?? 'Caballo no encontrado'}</div>
      <button onClick={() => navigate('/horses')} style={{ color: '#635BFF', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
        ← Volver a Caballos
      </button>
    </div>
  );

  const wins = results.filter(r => r.placement === 1).length;
  const top3 = results.filter(r => r.placement != null && r.placement <= 3).length;
  const age = horse.birthYear ? new Date().getFullYear() - horse.birthYear : null;

  return (
    <div style={{ background: '#F6F9FC', minHeight: '100vh', padding: '0 0 48px' }}>

      {/* ── Top bar ── */}
      <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E3E8EF', padding: '0 32px', height: 56, display: 'flex', alignItems: 'center', gap: 16 }}>
        <button
          onClick={() => navigate('/horses')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#697386', fontWeight: 600, fontSize: 14, padding: '6px 0' }}
        >
          <ArrowLeft size={16} /> Caballos
        </button>
        <span style={{ color: '#E3E8EF' }}>/</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#0A2540' }}>{horse.name}</span>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 0' }}>

        {/* ── Hero header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 32, flexWrap: 'wrap' }}>
          {/* Avatar */}
          <div style={{
            width: 72, height: 72, borderRadius: 18, flexShrink: 0,
            background: 'linear-gradient(135deg, #635BFF 0%, #7C74FF 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 38, fontFamily: 'serif', boxShadow: '0 4px 16px rgba(99,91,255,0.25)',
          }}>
            ♞
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
              <h1 style={{ margin: 0, fontSize: 30, fontWeight: 900, color: '#0A2540', letterSpacing: '-0.5px' }}>
                {horse.name}
              </h1>
              {horse.feiId && (
                <a
                  href={`https://www.fei.org/horse/${horse.feiId}/results`}
                  target="_blank" rel="noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: '#635BFF', textDecoration: 'none', background: 'rgba(99,91,255,0.08)', borderRadius: 8, padding: '4px 10px' }}
                >
                  FEI <ExternalLink size={12} />
                </a>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {horse.countryCode && <Chip>{flag(horse.countryCode)} {horse.countryCode}</Chip>}
              {horse.feiId && <Chip>{horse.feiId}</Chip>}
              {horse.birthYear && <Chip>🗓 {horse.birthYear}{age ? ` · ${age} años` : ''}</Chip>}
              {horse.gender && <Chip color={GENDER_COLOR[horse.gender]}>{genderLabel(horse.gender)}</Chip>}
              {horse.breed && <Chip>{horse.breed}</Chip>}
              {horse.color && <Chip>🎨 {horse.color}</Chip>}
            </div>
          </div>
        </div>

        {/* ── Two-column layout ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,340px) 1fr', gap: 24, alignItems: 'start' }}>

          {/* ── LEFT column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Stats */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E3E8EF', borderRadius: 16, padding: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#4A5568', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 14 }}>Estadísticas</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <StatCard label="Starts" value={results.length} />
                <StatCard label="Victorias" value={wins} accent={wins > 0} />
                <StatCard label="Top 3" value={top3} />
              </div>
            </div>

            {/* Pedigree */}
            {(horse.sire || horse.dam || horse.damSire || horse.currentRider || horse.owner || horse.haras) && (
              <div style={{ background: '#FFFFFF', border: '1px solid #E3E8EF', borderRadius: 16, padding: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#4A5568', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 14 }}>Información</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {horse.sire && <PedigreeRow label="Padre" value={horse.sire} />}
                  {horse.dam && <PedigreeRow label="Madre" value={horse.dam} />}
                  {horse.damSire && <PedigreeRow label="Abuelo materno" value={horse.damSire} />}
                  {horse.currentRider && <PedigreeRow label="Jinete" value={horse.currentRider} icon={<User size={13} color="#635BFF" />} />}
                  {horse.owner && <PedigreeRow label="Propietario" value={horse.owner} />}
                  {horse.haras && <PedigreeRow label="Haras" value={horse.haras} />}
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT column: Results ── */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E3E8EF', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px 14px', borderBottom: '1px solid #F0F4F8', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0A2540' }}>Historial de competencias</div>
              {results.length > 0 && (
                <div style={{ fontSize: 12, color: '#697386' }}>
                  {results.length} starts · {wins} victoria{wins !== 1 ? 's' : ''}
                </div>
              )}
            </div>

            {results.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: '#A3ACBA', fontSize: 14 }}>
                Sin resultados registrados
              </div>
            ) : (
              <div style={{ padding: '8px 16px 16px' }}>
                {results.map((r) => {
                  const isWin = r.placement === 1;
                  const isTop3 = r.placement != null && r.placement <= 3;
                  return (
                    <div
                      key={r.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 10px',
                        borderRadius: 10, marginBottom: 2,
                        background: isWin ? 'rgba(99,91,255,0.04)' : 'transparent',
                        border: `1px solid ${isWin ? 'rgba(99,91,255,0.14)' : 'transparent'}`,
                      }}
                    >
                      {/* Position badge */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: isWin ? '#635BFF' : isTop3 ? 'rgba(48,181,124,0.12)' : '#F0F4F8',
                        color: isWin ? '#fff' : isTop3 ? '#30B57C' : '#A3ACBA',
                        fontSize: 13, fontWeight: 800,
                      }}>
                        {isWin ? <Trophy size={15} /> : (r.placement ?? '—')}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#0A2540' }}>{r.eventName}</span>
                          <span style={{
                            fontSize: 11, background: '#E8EDF3', color: '#2D3748',
                            borderRadius: 5, padding: '1px 7px', fontWeight: 700,
                          }}>{r.level}</span>
                          {r.category && (
                            <span style={{ fontSize: 12, color: '#4A5568', fontWeight: 500 }}>{r.category}</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 3 }}>
                          <span style={{ fontSize: 12, color: '#4A5568', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Calendar size={11} />{r.eventDate}
                          </span>
                          {r.riderName && (
                            <span style={{ fontSize: 12, color: '#4A5568', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <User size={11} />{r.riderName}
                            </span>
                          )}
                          {r.eventCountry && (
                            <span style={{ fontSize: 12, color: '#4A5568', display: 'flex', alignItems: 'center', gap: 4 }}>
                              <MapPin size={11} />{flag(r.eventCountry)} {r.eventCountry}
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
    </div>
  );
}

function PedigreeRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#697386', letterSpacing: '0.04em', textTransform: 'uppercase', minWidth: 110, paddingTop: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#0A2540', display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon}{value}
      </div>
    </div>
  );
}
