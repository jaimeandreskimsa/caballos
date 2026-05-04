import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Trophy, BarChart3, Database, Settings } from 'lucide-react';

const NAV = [
  { to: '/',          label: 'Inicio',     icon: LayoutDashboard },
  { to: '/horses',    label: 'Caballos',   icon: Trophy },
  { to: '/valuation', label: 'Valorar',    icon: BarChart3 },
  { to: '/data',      label: 'Datos',      icon: Database },
  { to: '/settings',  label: 'Ajustes',    icon: Settings },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav bottom-nav-mobile">
      {NAV.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
        >
          {({ isActive }) => (
            <>
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
