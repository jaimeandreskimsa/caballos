import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BarChart3, Database, Settings } from 'lucide-react';

function HorseHeadIcon({ size = 20 }: { size?: number; strokeWidth?: number }) {
  return (
    <span style={{ fontSize: size * 1.1, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'serif' }}>
      ♞
    </span>
  );
}

const NAV = [
  { to: '/',          label: 'Inicio',     icon: LayoutDashboard },
  { to: '/horses',    label: 'Caballos',   icon: null, customIcon: HorseHeadIcon },
  { to: '/valuation', label: 'Valorar',    icon: BarChart3 },
  { to: '/data',      label: 'Datos',      icon: Database },
  { to: '/settings',  label: 'Ajustes',    icon: Settings },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav bottom-nav-mobile">
      {NAV.map(({ to, label, icon: Icon, customIcon: CustomIcon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
        >
          {({ isActive }) => (
            <>
              {CustomIcon
                ? <CustomIcon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                : Icon && <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
              }
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
