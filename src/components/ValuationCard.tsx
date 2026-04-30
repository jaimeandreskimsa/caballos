import type { Valuation } from '../types';
import { ScoreRing } from './ScoreRing';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Info } from 'lucide-react';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const RISK_COLOR = { low: '#22C55E', medium: '#F59E0B', high: '#EF4444' };
const RISK_ICON = { low: CheckCircle, medium: AlertTriangle, high: AlertTriangle };
const RISK_LABEL = { low: 'Bajo', medium: 'Medio', high: 'Alto' };

interface Props { valuation: Valuation; }

export function ValuationCard({ valuation: v }: Props) {
  const RiskIcon = RISK_ICON[v.risk];
  const riskColor = RISK_COLOR[v.risk];

  return (
    <div style={{
      background: '#FFFFFF', border: '1px solid #EBEBEB', borderRadius: 16,
      overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #F8F8F8 0%, #F2F2F2 100%)',
        padding: '20px 24px', borderBottom: '1px solid #EBEBEB',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 13, color: '#888888', marginBottom: 4, fontWeight: 600, letterSpacing: '0.06em' }}>VALORACIÓN ESTIMADA</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#B8963E' }}>
            {fmt(v.valueMin)} – {fmt(v.valueMax)}
          </div>
          <div style={{ fontSize: 13, color: '#888888', marginTop: 4 }}>
            Punto medio: <strong style={{ color: '#111111' }}>{fmt(v.valueMid)}</strong>
          </div>
        </div>
        <ScoreRing score={v.scores.overall} size={90} label="Score total" />
      </div>

      {/* Score breakdown */}
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #F0F0F0' }}>
        <div style={{ fontSize: 12, color: '#888888', marginBottom: 16, fontWeight: 600, letterSpacing: 1 }}>
          DESGLOSE DE PUNTAJE
        </div>
        <div style={{ display: 'flex', gap: 20, justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <ScoreRing score={v.scores.performance} size={72} label="Performance" color="#22C55E" />
          <ScoreRing score={v.scores.breeding} size={72} label="Linaje" color="#3B82F6" />
          <ScoreRing score={v.scores.agePotential} size={72} label="Edad/Potencial" color="#8B5CF6" />
          <ScoreRing score={v.scores.marketDemand} size={72} label="Demanda" color="#F59E0B" />
        </div>
      </div>

      {/* Meta */}
      <div style={{ padding: '16px 24px', display: 'flex', gap: 16, flexWrap: 'wrap', borderBottom: '1px solid #F0F0F0' }}>
        <Chip
          icon={<Info size={12} />}
          label={`Percentil ${v.percentile}`}
          color="#B8963E"
        />
        <Chip
          icon={<RiskIcon size={12} />}
          label={`Riesgo: ${RISK_LABEL[v.risk]}`}
          color={riskColor}
        />
        <Chip
          icon={v.projection2y >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          label={`Proyección 2y: ${v.projection2y >= 0 ? '+' : ''}${v.projection2y}%`}
          color={v.projection2y >= 0 ? '#4caf50' : '#f44336'}
        />
      </div>

      {/* Comparables */}
      {v.comparables.length > 0 && (
        <div style={{ padding: '0 24px 20px' }}>
          <div style={{ fontSize: 12, color: '#888888', marginBottom: 12, fontWeight: 600, letterSpacing: 1 }}>
            VENTAS COMPARABLES
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {v.comparables.map((c, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: '#F7F7F7', borderRadius: 8, padding: '10px 14px',
                border: '1px solid #EBEBEB',
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{c.horseName}</div>
                  <div style={{ fontSize: 11, color: '#888888' }}>
                    {c.age}y · {c.level} · {c.source} · {c.saleDate}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#B8963E' }}>{fmt(c.salePrice)}</div>
                  <div style={{ fontSize: 11, color: '#888888' }}>{c.similarity}% similar</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: `${color}1a`, color, border: `1px solid ${color}40`,
      borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 600,
    }}>
      {icon}{label}
    </span>
  );
}
