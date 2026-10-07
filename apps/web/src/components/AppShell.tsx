import { useState, type ReactNode } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { Icon, LogoMark, type IconName } from './Icon';
import { ThemeToggle } from './ThemeToggle';

interface NavItem {
  label: string;
  to: string;
  icon: IconName;
}

const primary: NavItem[] = [
  { label: 'Analyze', to: '/analyze', icon: 'scan' },
  { label: 'History', to: '/history', icon: 'history' },
  { label: 'Incident help', to: '/incident', icon: 'warning' },
];

const explore: NavItem[] = [
  { label: 'Community intelligence', to: '/community', icon: 'globe' },
  { label: 'Scam patterns', to: '/patterns', icon: 'document' },
  { label: 'Verify a claim', to: '/verify', icon: 'search' },
];

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  return (
    <NavLink to={item.to} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`} onClick={onNavigate}>
      <Icon name={item.icon} size={18} />
      <span>{item.label}</span>
    </NavLink>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="app-frame">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header className="topbar">
        <Link className="brand" to="/" aria-label="ScamBreak home">
          <LogoMark size={31} />
          <span>Scam<span>Break</span></span>
        </Link>
        <div className="topbar-status"><span className="status-dot" />Defensive analysis workspace</div>
        <nav className="topbar-actions" aria-label="Account">
          <ThemeToggle />
          <Link className="quiet-link" to="/patterns">How it works</Link>
          <Link className="account-link" to="/account"><Icon name="user" size={17} />Account</Link>
        </nav>
        <button className="mobile-menu-button" type="button" aria-label="Open navigation" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>
          <Icon name={menuOpen ? 'close' : 'menu'} />
        </button>
      </header>
      <aside className={`sidebar ${menuOpen ? 'open' : ''}`} aria-label="Main navigation">
        <div className="sidebar-inner">
          <p className="nav-label">Your workspace</p>
          {primary.map((item) => <SidebarLink key={item.to} item={item} onNavigate={() => setMenuOpen(false)} />)}
          <p className="nav-label nav-label-spaced">Explore</p>
          {explore.map((item) => <SidebarLink key={item.to} item={item} onNavigate={() => setMenuOpen(false)} />)}
          <div className="sidebar-spacer" />
          <SidebarLink item={{ label: 'Settings & privacy', to: '/account', icon: 'settings' }} onNavigate={() => setMenuOpen(false)} />
          <SidebarLink item={{ label: 'Moderation', to: '/admin', icon: 'shield' }} onNavigate={() => setMenuOpen(false)} />
          <div className="sidebar-protection">
            <Icon name="lock" size={17} />
            <span>Private evidence is never published automatically.</span>
          </div>
        </div>
      </aside>
      <main id="main-content" className="main-content">{children}</main>
      <nav className="mobile-bottom-nav" aria-label="Quick navigation">
        {primary.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => `bottom-link ${isActive ? 'active' : ''}`}>
            <Icon name={item.icon} size={19} />
            <span>{item.label === 'Incident help' ? 'Incident' : item.label}</span>
          </NavLink>
        ))}
        <NavLink to="/account" className={({ isActive }) => `bottom-link ${isActive ? 'active' : ''}`}>
          <Icon name="more" size={19} /><span>More</span>
        </NavLink>
      </nav>
    </div>
  );
}
