import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';

const DESKTOP_BREAKPOINT = 860;

const navSections = [
  {
    title: 'Menu',
    items: [
      { to: '/historique', label: 'Historique', icon: '/icons/historique.png' },
      { to: '/prediction', label: 'Prediction', icon: '/icons/prediction.png' },
      { to: '/carte', label: 'Carte', icon: '/icons/adresse.png' },
      { to: '/assistant-ia', label: 'Assistant IA', icon: '/icons/assistant.png' },
    ],
  },
  {
    title: 'General',
    items: [
      { to: '/parametre', label: 'Parametre', icon: '/icons/parametre.png' },
      { to: '/support', label: 'Support', icon: '/icons/support.png' },
    ],
  },
];

function Sidebar() {
  const linkClass = ({ isActive }) => `nav-link${isActive ? ' active' : ''}`;
  const [isOpen, setIsOpen] = useState(true);
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    return window.innerWidth >= DESKTOP_BREAKPOINT;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('sidebar-open', isOpen);
    return () => document.body.classList.remove('sidebar-open');
  }, [isOpen]);

  return (
    <div className="sidebar-shell">
      <div className="brand-bar">
        <div className="brand-left">
          <button
            className="icon-button brand-toggle"
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            aria-label={isOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          >
            <span className={isOpen ? 'icon-arrow' : 'icon-bars'}></span>
          </button>
        </div>
      </div>

      <button
        className={`sidebar-overlay ${isOpen && !isDesktop ? 'show' : ''}`}
        type="button"
        onClick={() => {
          if (!isDesktop) {
            setIsOpen(false);
          }
        }}
        aria-label="Fermer le menu"
      />

      <aside className={`sidebar ${isOpen ? 'open' : 'collapsed'}`}>
        <div className="sidebar-brand-card">
          <div className="brand-icon sidebar-brand-icon">
            <img src="/logo.png" alt="Logo ASECNA" />
          </div>
          <div>
            <p className="brand-title sidebar-brand-title">ASECNA EFP</p>
            <span className="brand-sub sidebar-brand-sub">Centre de pilotage</span>
          </div>
        </div>

        {navSections.map((section) => (
          <div key={section.title} className="sidebar-nav-section">
            <p className="sidebar-section-title">{section.title}</p>
            <nav className="sidebar-nav">
              {section.items.map((item) => (
                <NavLink key={item.to} className={linkClass} to={item.to}>
                  <span className="nav-icon" aria-hidden="true">
                    <img src={item.icon} alt="" />
                  </span>
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        ))}
      </aside>
    </div>
  );
}

export default Sidebar;
