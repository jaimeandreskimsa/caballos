import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BarChart3, Database, Settings } from 'lucide-react';

function HorseHeadIcon({ size = 20 }: { size?: number; strokeWidth?: number }) {
  // Full galloping horse silhouette path (viewBox 0 0 64 64)
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">
      <path d="M58 6c-1-2-3-3-5-2l-4 2c-1-2-3-3-5-2l-3 1c-1-2-4-3-6-1l-2 2c-2-1-5 0-6 2l-1 2c-3 1-5 3-5 6v3l-4 4-2 1H9c-2 0-3 1-3 3s1 3 3 3h5l-3 6c-1 2 0 4 2 5s4 0 5-2l4-9h2l-2 10c0 2 1 4 3 4s4-1 4-3l2-11 3-1v15c0 2 2 4 4 4s4-2 4-4V29c2-1 4-3 4-6v-1l4-3c2-1 3-4 2-6l-1-2 3-1c2-1 3-3 2-5l1-1c1-2 1-4-1-5 0 0 3 0 4-2l1-1c1-2 0-4-2-5zM31 18l-1 2-2-1 1-2 2 1zm3-4l-1 2-2-1 1-2 2 1zm4-3l-1 2-2-1 1-2 2 1z"/>
    </svg>
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
