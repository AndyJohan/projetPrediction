import AfricaMapExact from '../components/AfricaMapExact';

function CartePage() {
  return (
    <section className="section page-carte">
      <header className="topbar">
        <div>
          <p className="eyebrow">Carte</p>
          <h1>Cartographie des equipements</h1>
        </div>
      </header>

      <div className="section-header">
        <div>
          <h2>Madagascar interactive</h2>
          <p className="muted">Visualisation  des sites ASECNA Madagascar et les iles voisines</p>
        </div>
        
      </div>

      <div className="card africa-map-page-card">
        <AfricaMapExact />
      </div>
    </section>
  );
}

export default CartePage;
