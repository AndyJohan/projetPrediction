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
            {/* <Link className="ghost-button home-action" to="/historique">Consulter l’historique</Link> */}
          </div>
        </div>
        <div className="home-logo-panel" aria-label="Logo ASECNA">
          <div className="home-logo-orbit" aria-hidden="true" />
          <img src="/logo.png" alt="Logo ASECNA" className="home-logo" />
          <span className="home-logo-label">ASECNA</span>
        </div>
      </div>

      <section className="home-about" aria-labelledby="about-title">
        <div className="home-about-heading">
          <p className="eyebrow">À propos</p>
          <h2 id="about-title">Une maintenance plus anticipative</h2>
        </div>
        <div className="home-about-content">
          <p>
            Asecna EFP centralise les informations de vos équipements pour aider les équipes
            techniques à détecter les risques de panne, suivre leur évolution et planifier les
            interventions au bon moment.
          </p>
          <ul className="home-about-features">
            <li>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19V9m5 10V5m5 14v-7m5 7V3" /></svg>
              <div>
                <h3>Prédictions de risque</h3>
                <p>Le module de prédiction évalue l’état de chaque équipement à partir des données disponibles. Il met en évidence les risques de panne afin que les équipes puissent concentrer leur attention sur les installations qui nécessitent une surveillance ou une intervention prioritaire.</p>
              </div>
            </li>
            <li>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l2.2-6 4.1 12 2.2-6H21" /></svg>
              <div>
                <h3>Historique analysable</h3>
                <p>L’historique rassemble les résultats et événements précédents pour suivre l’évolution des équipements dans le temps. Ces informations facilitent l’identification des tendances, la comparaison des périodes et l’amélioration progressive des décisions de maintenance.</p>
              </div>
            </li>
            <li>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v4m0 10v4M3 12h4m10 0h4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8m0-12.8-2.8 2.8m-7.2 7.2-2.8 2.8" /><circle cx="12" cy="12" r="3" /></svg>
              <div>
                <h3>Assistant IA</h3>
                <p>L’Assistant IA permet d’interroger les données de manière simple et directe. Il aide à interpréter les résultats de prédiction, à obtenir des explications sur une situation et à orienter plus rapidement les équipes vers les informations utiles.</p>
              </div>
            </li>
            <li>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="m12 8 2.5 4.5L12 16l-2.5-3.5L12 8Z" /></svg>
              <div>
                <h3>Vue géographique</h3>
                <p>La carte offre une vue d’ensemble des sites et de leur localisation. Elle aide à situer rapidement les équipements concernés, à coordonner les interventions sur le terrain et à mieux répartir les actions de maintenance.</p>
              </div>
            </li>
          </ul>
        </div>
      </section>
    </section>
  );
}

export default HomePage;
