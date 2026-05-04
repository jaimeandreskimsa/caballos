import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Trophy, Download, BarChart3, Database, Settings,
  LogOut, ChevronLeft, ChevronRight, Zap,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';

const NAV = [
  { to: '/',          label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/horses',    label: 'Caballos',    icon: Trophy },
  { to: '/valuation', label: 'Valoración',  icon: BarChart3 },
  { to: '/import',    label: 'Importar FEI',icon: Download },
  { to: '/data',      label: 'Datos',       icon: Database },
  { to: '/settings',  label: 'Ajustes',     icon: Settings },
];

export function Sidebar() {
  const logout = useAppStore((s) => s.logout);
  const [collapsed, setCollapsed] = useState(false);
  const W = collapsed ? 64 : 232;

  return (
    <aside style={{
      width: W,
      minHeight: '100vh',
      flexShrink: 0,
      background: '#FFFFFF',
      borderRight: '1px solid #E3E8EF',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0,
      height: '100vh',
      overflow: 'hidden',
      transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
      boxShadow: '2px 0 8px rgba(0,0,0,0.04)',
    }}>

      {/* ── Logo ── */}
      <div style={{
        padding: collapsed ? '18px 0' : '16px 16px',
        borderBottom: '1px solid #E3E8EF',
        display: 'flex', alignItems: 'center', gap: 10,
        minHeight: 64,
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}>
        <div className="ev-horse-icon" style={{
          width: 36, height: 36, flexShrink: 0,
          background: 'linear-gradient(135deg, #635BFF 0%, #7C74FF 100%)',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, lineHeight: 1,
          boxShadow: '0 2px 8px rgba(99,91,255,0.3)',
          userSelect: 'none', cursor: 'default',
        }}>
          ♞
        </div>

        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{
              fontSize: 15, fontWeight: 800, letterSpacing: '-0.3px', whiteSpace: 'nowrap',
              color: '#0A2540',
            }}>
              EquiValue
            </div>
            <div style={{
              fontSize: 9, fontWeight: 600, color: '#A3ACBA',
              letterSpacing: '0.12em', textTransform: 'uppercase', whiteSpace: 'nowrap',
            }}>
              AI Platform
            </div>
          </div>
        )}
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto' }}>
        {!collapsed && (
          <div style={{
            fontSize: 9, fontWeight: 700, color: '#A3ACBA',
            letterSpacing: '0.1em', textTransform: 'uppercase',
            padding: '4px 8px 8px',
          }}>
            Menú
          </div>
        )}

        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} style={{ textDecoration: 'none' }}>
            {({ isActive }) => (
              <div
                className={!isActive ? 'ev-nav-item' : ''}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: 9,
                  padding: collapsed ? '10px 0' : '9px 10px',
                  borderRadius: 8,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  color: isActive ? '#635BFF' : '#697386',
                  background: isActive ? 'rgba(99,91,255,0.08)' : 'transparent',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: 13.5,
                  cursor: 'pointer',
                  position: 'relative',
                }}>
                {isActive && !collapsed && (
                  <div style={{
                    position: 'absolute', left: 0, top: '15%', bottom: '15%',
                    width: 3, borderRadius: '0 3px 3px 0',
                    background: '#635BFF',
                  }} />
                )}
                <Icon size={16} strokeWidth={isActive ? 2.5 : 1.8} />
                {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{label}</span>}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Bottom ── */}
      <div style={{ padding: '8px', borderTop: '1px solid #E3E8EF', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {!collapsed && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 10px',
            background: '#F6F9FC',
            border: '1px solid #E3E8EF',
            borderRadius: 8, marginBottom: 4,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #635BFF, #7C74FF)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: '#FFFFFF',
            }}>A</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#0A2540' }}>Admin</div>
              <div style={{ fontSize: 10, color: '#A3ACBA', display: 'flex', alignItems: 'center', gap: 3 }}>
                <Zap size={9} color="#635BFF" />
                Pro Plan
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => setCollapsed((c) => !c)}
          className="ev-btn-ghost"
          style={{
            display: 'flex', alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 8, padding: '8px 10px', fontSize: 12, width: '100%',
          }}
        >
          {collapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /><span>Colapsar</span></>}
        </button>

        <button
          onClick={logout}
          style={{
            display: 'flex', alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 8, padding: '8px 10px',
            background: 'transparent', border: '1px solid transparent',
            borderRadius: 8, color: '#A3ACBA',
            fontSize: 12, cursor: 'pointer', width: '100%',
            fontFamily: 'inherit',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#E5483B';
            e.currentTarget.style.background = 'rgba(229,72,59,0.06)';
            e.currentTarget.style.borderColor = 'rgba(229,72,59,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#A3ACBA';
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'transparent';
          }}
        >
          <LogOut size={14} />
          {!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </aside>
  );
}

