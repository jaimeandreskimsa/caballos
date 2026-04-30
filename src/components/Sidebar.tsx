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


