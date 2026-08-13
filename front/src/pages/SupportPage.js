function SupportPage() {
  return (
    <section className="section page-support">
      <header className="topbar">
        <div>
          <p className="eyebrow">Support</p>
          <h1>Centre de support</h1>
        </div>
        <div className="topbar-actions">
          <button className="ghost-button">Ouvrir un ticket</button>
        </div>
      </header>

      <div className="section-header">
        <div>
          <h2>Assistance & documentation</h2>
          <p className="muted">Base de connaissances et contact prioritaire</p>
        </div>
      </div>

      <div className="grid-3">
        <div className="card">
          <h3>Guide de diagnostic</h3>
          <p className="muted">Procedures rapides pour les equipes terrain.</p>
        </div>
        <div className="card">
          <h3>Centre d'aide</h3>
          <p className="muted">Articles techniques et bonnes pratiques.</p>
        </div>
        <div className="card">
          <h3>Contacts prioritaires</h3>
          <p className="muted">Support 24/7 pour incidents critiques.</p>
        </div>
      </div>
    </section>
  );
}

export default SupportPage;
