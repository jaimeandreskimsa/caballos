import { NavLink } from 'react-router-dom';
import { LayoutDashboard, BarChart3, Database, Settings } from 'lucide-react';

function HorseHeadIcon({ size = 20, strokeWidth = 1.8 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {/* Horse head silhouette as path */}
      <path d="M5 20 C5 20 5 16 7 14 C8 13 8 11 7 10 C6 9 6 7 8 6 C10 5 11 4 13 4 C15 4 17 5 18 7 C19 9 19 11 18 13 C17 14 16 14 16 16 L16 20" />
      <path d="M16 16 C16 16 14 15 12 16 C10 17 8 17 7 16" />
      <circle cx="15" cy="8" r="0.8" fill="currentColor" stroke="none" />
      <path d="M13 4 C13 4 14 2 16 2 C16 2 15 4 15 5" />
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
