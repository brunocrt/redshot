import React from 'react';

/**
 * Sidebar navigation component.  Renders a list of navigation buttons and a
 * logout button.  Accepts ``activeSection`` and ``setActiveSection`` to
 * control which content is displayed, as well as ``handleLogout`` to log
 * the user out.  The sidebar can be collapsed via ``sidebarCollapsed``,
 * hiding it on medium screens and larger.
 */
export default function Sidebar({ activeSection, setActiveSection, handleLogout, sidebarCollapsed }) {
  const navItem = (section, label) => (
    <li className="nav-item" key={section}>
      <button
        className={`nav-link text-start ${activeSection === section ? 'active' : ''}`}
        onClick={() => setActiveSection(section)}
      >
        {label}
      </button>
    </li>
  );
  return (
    <nav
      className={`col-md-2 bg-dark sidebar py-4 ${sidebarCollapsed ? 'd-md-none' : 'd-none d-md-block'}`}
    >
      <div className="position-sticky">
        <h4 className="text-light px-3 mb-4">Navigation</h4>
        <ul className="nav nav-pills flex-column mb-auto">
          {navItem('portfolio', 'Portfolio')}
          {navItem('recommendations', 'Recommendations')}
          {navItem('trades', 'Trades')}
          {navItem('research', 'Research & Strategy')}
          {navItem('strategy', 'Strategy')}
          {navItem('strategy_chart', 'Strategy Chart')}
          {navItem('simulation', 'Simulation Settings')}
          <li className="nav-item mt-3">
            <button className="nav-link text-start text-danger" onClick={handleLogout}>
              Logout
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
}