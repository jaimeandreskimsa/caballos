import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Trophy, Search, BarChart3, Database, Settings,
  LogOut, ChevronLeft, ChevronRight, Zap,
} from 'lucide-react';
import { useAppStore } from '../store/appStore';

const NAV = [
  { to: '/',          label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/horses',    label: 'Caballos',    icon: Trophy },
  { to: '/valuation', label: 'Valoración',  icon: BarChart3 },
  { to: '/search',    label: 'Buscar FEI',  icon: Search },
  { to: '/data',      label: 'Datos',       icon: Database },
  { to: '/settings',  label: 'Ajustes',     icon: Settings },
];

export function Sidebar() {
  const logout = useAppStore((s) => s.logout);
  const [collapsed, setCollapsed] = useState(false);
  const W = collapsed ? 68 : 240;

  return (
    <aside style={{
      width: W,
      minHeight: '100vh',
      flexShrink: 0,
      background: 'linear-gradient(180deg, #0D1117 0%, #080B12 100%)',
      borderRight: '1px solid rgba(201,151,44,0.12)',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0,
      height: '100vh',
      overflow: 'hidden',
      transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
      boxShadow: '4px 0 24px rgba(0,0,0,0.4)',
    }}>

      {/* ── Logo ── */}
      <div style={{
        padding: collapsed ? '20px 0' : '18px 18px',
        borderBottom: '1px solid rgba(201,151,44,0.1)',
        display: 'flex', alignItems: 'center', gap: 12,
        minHeight: 70,
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}>
        <div className="ev-horse-icon" style={{
          width: 38, height: 38, flexShrink: 0,
          background: 'linear-gradient(135deg, #C9972C 0%, #F0B429 60%, #E8760A 100%)',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, lineHeight: 1,
          boxShadow: '0 0 20px rgba(201,151,44,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
          userSelect: 'none', cursor: 'default', position: 'relative',
        }}>
          ♞
          <div style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 8, height: 8, borderRadius: '50%',
            background: '#22C55E', border: '2px solid #080B12',
          }} />
        </div>

        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div className="ev-shimmer" style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>
              EquiValue
            </div>
            <div style={{
              fontSize: 9, fontWeight: 700, color: 'rgba(201,151,44,0.5)',
              letterSpacing: '0.14em', textTransform: 'uppercase', whiteSpace: 'nowrap',
            }}>
              AI · Platform
            </div>
          </div>
        )}
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
        {!collapsed && (
          <div style={{
            fontSize: 9, fontWeight: 700, color: 'rgba(201,151,44,0.35)',
            letterSpacing: '0.12em', textTransform: 'uppercase',
            padding: '4px 10px 10px',
          }}>
            Navegación
          </div>
        )}

        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} style={{ textDecoration: 'none' }}>
            {({ isActive }) => (
              <div
                className={!isActive ? 'ev-nav-item' : ''}
                style={{
                  display: 'flex', alignItems: 'center',
                  gap: 10,
                  padding: collapsed ? '11px 0' : '10px 12px',
                  borderRadius: 10,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  color: isActive ? '#F0B429' : 'rgba(160,143,130,0.8)',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(201,151,44,0.18) 0%, rgba(201,151,44,0.06) 100%)'
                    : 'transparent',
                  fontWeight: isActive ? 700 : 400,
                  fontSize: 13.5,
                  position: 'relative',
                  cursor: 'pointer',
                  boxShadow: isActive ? 'inset 0 0 0 1px rgba(201,151,44,0.2)' : 'none',
                }}>
                {isActive && (
                  <div style={{
                    position: 'absolute', left: 0, top: '20%', bottom: '20%',
                    width: 3, borderRadius: '0 3px 3px 0',
                    background: 'linear-gradient(180deg, #F0B429, #C9972C)',
                    boxShadow: '0 0 8px rgba(201,151,44,0.6)',
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
      <div style={{ padding: '8px', borderTop: '1px solid rgba(201,151,44,0.08)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {!collapsed && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px',
            background: 'rgba(201,151,44,0.06)',
            border: '1px solid rgba(201,151,44,0.12)',
            borderRadius: 10, marginBottom: 4,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #C9972C, #F0B429)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 800, color: '#1A0F00',
              boxShadow: '0 0 10px rgba(201,151,44,0.3)',
            }}>A</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#F0EDE8' }}>Admin</div>
              <div style={{ fontSize: 10, color: 'rgba(201,151,44,0.6)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <Zap size={9} color="#F0B429" />
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
            gap: 8, padding: '8px 12px', fontSize: 12, width: '100%',
          }}
        >
          {collapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /><span>Colapsar</span></>}
        </button>

        <button
          onClick={logout}
          style={{
            display: 'flex', alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 8, padding: '8px 12px',
            background: 'transparent', border: '1px solid transparent',
            borderRadius: 10, color: 'rgba(160,143,130,0.6)',
            fontSize: 12, cursor: 'pointer', width: '100%',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#EF4444';
            e.currentTarget.style.background = 'rgba(239,68,68,0.08)';
            e.currentTarget.style.borderColor = 'rgba(239,68,68,0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(160,143,130,0.6)';
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.borderColor = 'transparent';
          }}
        >
          <LogOut size={13} />
          {!collapsed && <span>Salir</span>}
        </button>
      </div>
    </aside>
  );
}
import { useAppStore } from '../store/appStore';

const NAV = [
  { to: '/',          label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/horses',    label: 'Caballos',    icon: Trophy },
  { to: '/valuation', label: 'Valoración',  icon: BarChart3 },
  { to: '/search',    label: 'Buscar FEI',  icon: Search },
  { to: '/data',      label: 'Datos',       icon: Database },
  { to: '/settings',  label: 'Ajustes',     icon: Settings },
];

export function Sidebar() {
  const logout = useAppStore((s) => s.logout);
  const [collapsed, setCollapsed] = useState(false);
  const W = collapsed ? 64 : 236;

  return (
    <aside style={{
      width: W,
      minHeight: '100vh',
      flexShrink: 0,
      background: '#FDFAF7',
      borderRight: '1px solid rgba(0,0,0,0.07)',
      display: 'flex',
      flexDirection: 'column',
      position: 'sticky',
      top: 0,
      height: '100vh',
      overflow: 'hidden',
      transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
    }}>

      {/* ── Logo header ── */}
      <div style={{
        padding: collapsed ? '18px 14px' : '16px 16px',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minHeight: 66,
        justifyContent: collapsed ? 'center' : 'flex-start',
      }}>
        <div style={{
          width: 34,
          height: 34,
          flexShrink: 0,
          background: 'linear-gradient(135deg, #A0731A 0%, #C9922A 100%)',
          borderRadius: 9,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 20,
          lineHeight: 1,
          boxShadow: '0 0 18px rgba(160,115,26,0.15)',
          userSelect: 'none',
        }}>
          ♞
        </div>

        {!collapsed && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1612', letterSpacing: '-0.3px', whiteSpace: 'nowrap' }}>
              EquiValue
            </div>
            <div style={{ fontSize: 9.5, fontWeight: 600, color: '#A0731A', letterSpacing: '0.09em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              AI Platform
            </div>
          </div>
        )}
      </div>

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto' }}>
        {!collapsed && (
          <div style={{
            fontSize: 9, fontWeight: 700, color: '#C4BDB5',
            letterSpacing: '0.1em', textTransform: 'uppercase',
            padding: '4px 10px 8px',
          }}>
            Navegación
          </div>
        )}

        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} style={{ textDecoration: 'none' }}>
            {({ isActive }) => (
              <div
                className={!isActive ? 'ev-nav-item' : ''}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: collapsed ? '10px 0' : '9px 10px',
                  borderRadius: 8,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  color: isActive ? '#7A4F10' : '#7A6E64',
                  background: isActive ? 'rgba(160,115,26,0.09)' : 'transparent',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: 13.5,
                  position: 'relative',
                  cursor: 'pointer',
                }}>
                {isActive && (
                  <div style={{
                    position: 'absolute', left: 0, top: '15%', bottom: '15%',
                    width: 2.5, borderRadius: '0 2px 2px 0', background: '#A0731A',
                  }} />
                )}
                <Icon size={15} strokeWidth={isActive ? 2.5 : 1.8} />
                {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{label}</span>}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Bottom: user + controls ── */}
      <div style={{ padding: '8px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {!collapsed && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px',
            background: 'rgba(0,0,0,0.025)',
            borderRadius: 8, marginBottom: 4,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(160,115,26,0.1)',
              border: '1px solid rgba(160,115,26,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: '#A0731A',
            }}>A</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1612' }}>Admin</div>
              <div style={{ fontSize: 10, color: '#C4BDB5' }}>Pro Plan</div>
            </div>
            <Zap size={11} color="#C9A84C" />
          </div>
        )}

        <button
          onClick={() => setCollapsed((c) => !c)}
          style={{
            display: 'flex', alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 7, padding: '8px 10px',
            background: 'transparent', border: 'none', borderRadius: 7,
            color: '#C4BDB5', fontSize: 12, cursor: 'pointer', width: '100%',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#7A6E64'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#C4BDB5'; }}
        >
          {collapsed ? <ChevronRight size={14} /> : <><ChevronLeft size={14} /><span>Colapsar</span></>}
        </button>

        <button
          onClick={logout}
          style={{
            display: 'flex', alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 7, padding: '8px 10px',
            background: 'transparent', border: 'none', borderRadius: 7,
            color: '#C4BDB5', fontSize: 12, cursor: 'pointer', width: '100%',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = 'rgba(220,38,38,0.06)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#C4BDB5'; e.currentTarget.style.background = 'transparent'; }}
        >
          <LogOut size={13} />
          {!collapsed && <span>Salir</span>}
        </button>
      </div>
    </aside>
  );
}


