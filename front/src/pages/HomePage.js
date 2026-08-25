import { Link } from 'react-router-dom';
import './HomePage.css';

function HomePage() {
  return (
    <section className="section page-home" aria-labelledby="home-title">
      <div className="home-hero">
        <div className="home-copy">
          <p className="eyebrow">Système de prédiction des équipements</p>
          <h1 id="home-title">Asecna EFP</h1>
          <p className="home-lead">
            Anticipez les risques, suivez vos équipements et prenez des décisions de maintenance plus sûres.
          </p>
          <div className="home-actions">
            <Link className="primary-button home-action" to="/prediction">Voir les prédictions</Link>
            <Link className="ghost-button home-action" to="/historique">Consulter l’historique</Link>
          </div>
        </div>
        <div className="home-logo-panel" aria-label="Logo ASECNA">
          <div className="home-logo-orbit" aria-hidden="true" />
          <img src="/logo.png" alt="Logo ASECNA" className="home-logo" />
          <span className="home-logo-label">ASECNA</span>
        </div>
      </div>
      <div className="home-links" aria-label="Accès rapides">
        <Link to="/prediction" className="home-link-card"><span>01</span><strong>Prédictions</strong><small>Identifier les équipements à surveiller.</small></Link>
        <Link to="/historique" className="home-link-card"><span>02</span><strong>Historique</strong><small>Explorer les tendances et incidents passés.</small></Link>
        <Link to="/carte" className="home-link-card"><span>03</span><strong>Carte</strong><small>Localiser les sites et leurs informations.</small></Link>
      </div>
    </section>
  );
}

export default HomePage;
