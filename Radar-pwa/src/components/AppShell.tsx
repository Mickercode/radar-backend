import { Outlet, NavLink } from 'react-router-dom';
import { PwaInstall } from './PwaInstall';
import { Icon } from './Icon';

const navItems = [
  { to: '/', icon: 'feed' as const, label: 'Feed' },
  { to: '/capture', icon: 'capture' as const, label: 'Capture' },
  { to: '/knowledge', icon: 'bookmark' as const, label: 'Saved' },
  { to: '/notebook', icon: 'notebook' as const, label: 'Notes' },
  { to: '/brain', icon: 'brain' as const, label: 'Brain' },
  { to: '/profile', icon: 'profile' as const, label: 'Profile' },
] as const;

export function AppShell() {
  return (
    <div className="shell">
      {/* Top navigation bar */}
      <nav className="nav">
        <div className="nav__brand">
          <img
            src="/assets/logo-icon.jpeg"
            alt="Radar"
            className="nav__logo"
            width={52}
            height={52}
          />
        </div>
        <div className="nav__spacer" />
        <NavLink to="/settings" className="icon-btn" aria-label="Settings">
          <Icon name="settings" size={20} />
        </NavLink>
      </nav>

      {/* Main content area */}
      <main className="shell__main">
        <Outlet />
      </main>

      {/* PWA install prompt - centered and visible */}
      <PwaInstall />

      {/* Bottom dock navigation */}
      <nav className="dock" role="navigation" aria-label="Main navigation">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `dock__item${isActive ? ' is-active' : ''}`}
          >
            <Icon name={item.icon} size={22} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
