import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Line,
  Marker,
  ZoomableGroup,
} from 'react-simple-maps';
import { fetchCarteOverview } from '../services/carteApi';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';

const ISLAND_NAMES = {
  '174': 'Comores',
  '175': 'Mayotte',
  '450': 'Madagascar',
  '480': 'Maurice',
  '638': 'La Reunion',
  '690': 'Seychelles',
};

const ISLAND_CODES = new Set(Object.keys(ISLAND_NAMES));

const NEON = '#00d4ff';
const NEON_BRIGHT = '#00ffff';
const NEON_ACTIVE = '#80ffff';
const MAP_CENTER = [49, -18];
const BASE_SCALE = 2200;

const CITIES = [
  { id: '450-antananarivo', regionId: '450', name: 'Antananarivo', coordinates: [47.5167, -18.9333], dx: 10, dy: -10 },
  { id: '174-moroni', regionId: '174', name: 'Moroni', coordinates: [43.2551, -11.7172], dx: 10, dy: -10 },
  { id: '480-port-louis', regionId: '480', name: 'Port-Louis', coordinates: [57.5012, -20.1609], dx: 10, dy: -10 },
  { id: '638-saint-denis', regionId: '638', name: 'Saint-Denis', coordinates: [55.4481, -20.8789], dx: 10, dy: -10 },
  { id: '690-victoria', regionId: '690', name: 'Victoria', coordinates: [55.4536, -4.6191], dx: 10, dy: -10 },
  { id: '175-mamoudzou', regionId: '175', name: 'Mamoudzou', coordinates: [45.2279, -12.7806], dx: 10, dy: -10 },
  { id: '450-mahajanga', regionId: '450', name: 'Mahajanga', coordinates: [46.3167, -15.7167], dx: 10, dy: -10 },
  { id: '450-toamasina', regionId: '450', name: 'Toamasina', coordinates: [49.4, -18.1667], dx: 10, dy: -10 },
  { id: '450-toliary', regionId: '450', name: 'Toliary', coordinates: [43.6667, -23.35], dx: 10, dy: -10 },
  { id: '450-antsiranana', regionId: '450', name: 'Antsiranana', coordinates: [49.2917, -12.2833], dx: 10, dy: -10 },
  { id: '450-antalaha', regionId: '450', name: 'Antalaha', coordinates: [50.2833, -14.9], dx: 10, dy: -10 },
];

const ROUTES = [
  { id: 'route-fmnm', from: '450-antananarivo', to: '450-mahajanga', tooltip: 'lien ATS/DS vers FMNM' },
  { id: 'route-fmmt', from: '450-antananarivo', to: '450-toamasina', tooltip: 'lien ATS/DS vers FMMT' },
  { id: 'route-fmee', from: '450-antananarivo', to: '638-saint-denis', tooltip: 'lien ATS/DS vers FMEE' },
  { id: 'route-fimp', from: '450-antananarivo', to: '480-port-louis', tooltip: 'lien ATS/DS vers FIMP' },
  { id: 'route-fmcz', from: '450-antananarivo', to: '175-mamoudzou', tooltip: 'lien ATS/DS vers FMCZ' },
  { id: 'route-fmch', from: '450-antananarivo', to: '174-moroni', tooltip: 'lien ATS/DS vers FMCH' },
];

const CITY_TOOLTIPS = {
  '450-antananarivo': 'Station de ANTANANARIVO',
  '450-mahajanga': 'Station de MAHAJANGA',
  '450-toliary': 'Station de TOLIARY',
  '450-antsiranana': 'Station de ANTSIRANANA',
  '450-antalaha': 'Station de ANTALAHA',
};

function normalizeCountryId(id) {
  return String(id).padStart(3, '0');
}

function AfricaMapExact() {
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(null);
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, name: '' });
  const [zoom, setZoom] = useState(1);
  const [routePannes, setRoutePannes] = useState({});
  const containerRef = useRef(null);

  const selectedLabel = selected
    ? CITIES.find((city) => city.id === selected)?.name || ISLAND_NAMES[selected] || selected
    : null;
  const citiesById = Object.fromEntries(CITIES.map((city) => [city.id, city]));
  const routePannesByName = useMemo(() => routePannes, [routePannes]);

  useEffect(() => {
    let isMounted = true;

    const loadRoutePannes = async () => {
      try {
        const data = await fetchCarteOverview();
        if (!isMounted) {
          return;
        }

        const nextRoutePannes = Array.isArray(data?.routes)
          ? data.routes.reduce((accumulator, route) => {
              const routeKey = route?.label || route?.nomEquipement;

              if (routeKey) {
                accumulator[routeKey] = Number(route.totalPannes) || 0;
              }
              return accumulator;
            }, {})
          : {};

        setRoutePannes(nextRoutePannes);
      } catch (error) {
        if (isMounted) {
          setRoutePannes({});
        }
      }
    };

    loadRoutePannes();

    return () => {
      isMounted = false;
    };
  }, []);

  const getName = (geo) => {
    const normalizedId = normalizeCountryId(geo.id);
    return ISLAND_NAMES[normalizedId] || geo.properties?.name || normalizedId;
  };

  const handleGeoMove = (geo, event) => {
    setHovered(normalizeCountryId(geo.id));
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setTooltip({
      show: true,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      name: getName(geo),
    });
  };

  const handleLeave = () => {
    setHovered(null);
    setTooltip((current) => ({ ...current, show: false }));
  };

  const showTooltipAtPointer = (event, name) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setTooltip({
      show: true,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      name,
    });
  };

  return (
    <div style={styles.root}>
      <style>{css}</style>

      <div style={styles.scanlines} />
      <div style={{ ...styles.corner, top: 12, left: 12 }} />
      <div style={{ ...styles.corner, top: 12, right: 12, transform: 'scaleX(-1)' }} />
      <div style={{ ...styles.corner, bottom: 12, left: 12, transform: 'scaleY(-1)' }} />
      <div style={{ ...styles.corner, bottom: 12, right: 12, transform: 'scale(-1,-1)' }} />

      <header style={styles.header}>
        <span style={styles.blink}>O</span>
        <span style={styles.headerTitle}>MADAGASCAR / ILES VOISINES</span>
        <span style={styles.blink2}>O</span>
      </header>

      <div ref={containerRef} style={styles.mapWrap}>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ center: MAP_CENTER, scale: BASE_SCALE }}
          style={{ width: '100%', height: '100%' }}
        >
          <defs>
            <filter id="glow1" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="1.5" result="b1" />
              <feGaussianBlur stdDeviation="4" result="b2" />
              <feGaussianBlur stdDeviation="8" result="b3" />
              <feMerge>
                <feMergeNode in="b3" />
                <feMergeNode in="b2" />
                <feMergeNode in="b1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow2" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3" result="b1" />
              <feGaussianBlur stdDeviation="9" result="b2" />
              <feMerge>
                <feMergeNode in="b2" />
                <feMergeNode in="b1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <ZoomableGroup center={MAP_CENTER} zoom={zoom}>
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies
                  .filter((geo) => ISLAND_CODES.has(normalizeCountryId(geo.id)))
                  .map((geo) => {
                    const normalizedId = normalizeCountryId(geo.id);
                    const isHovered = hovered === normalizedId;
                    const isSelected = selected === normalizedId;
                    const stroke = isSelected ? NEON_ACTIVE : isHovered ? NEON_BRIGHT : NEON;
                    const fill = isSelected
                      ? 'rgba(0,255,255,0.22)'
                      : isHovered
                        ? 'rgba(0,212,255,0.13)'
                        : 'rgba(0,180,220,0.04)';
                    const strokeWidth = isSelected ? 0.9 : isHovered ? 0.75 : 0.4;

                    return (
                      <g key={geo.rsmKey}>
                        <Geography
                          geography={geo}
                          fill="none"
                          stroke={stroke}
                          strokeWidth={strokeWidth * 6}
                          strokeOpacity={isHovered || isSelected ? 0.35 : 0.1}
                          style={{ filter: 'url(#glow2)', pointerEvents: 'none' }}
                        />
                        <Geography
                          geography={geo}
                          fill="none"
                          stroke={stroke}
                          strokeWidth={strokeWidth * 2.5}
                          strokeOpacity={isHovered || isSelected ? 0.6 : 0.25}
                          style={{ filter: 'url(#glow1)', pointerEvents: 'none' }}
                        />
                        <Geography
                          geography={geo}
                          fill={fill}
                          stroke={stroke}
                          strokeWidth={strokeWidth}
                          strokeLinejoin="round"
                          style={{
                            transition: 'fill 180ms cubic-bezier(0.2, 0, 0, 1), stroke 180ms cubic-bezier(0.2, 0, 0, 1)',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(event) => handleGeoMove(geo, event)}
                          onMouseLeave={handleLeave}
                          onClick={() =>
                            setSelected((previous) => (previous === normalizedId ? null : normalizedId))
                          }
                        />
                      </g>
                    );
                  })
              }
            </Geographies>

            {ROUTES.map((route) => {
              const fromCity = citiesById[route.from];
              const toCity = citiesById[route.to];
              const isActive = hovered === route.id;
              const totalPannes = routePannesByName[route.tooltip] ?? 0;
              const routeTooltip = `${route.tooltip}\nNombre total de pannes : ${totalPannes}`;

              if (!fromCity || !toCity) {
                return null;
              }

              return (
                <Line
                  key={route.id}
                  from={fromCity.coordinates}
                  to={toCity.coordinates}
                  stroke={isActive ? 'rgba(0, 255, 255, 0.9)' : 'rgba(0, 212, 255, 0.32)'}
                  strokeWidth={isActive ? 2.2 : 1.2}
                  strokeLinecap="round"
                  strokeDasharray="4 6"
                  style={{
                    filter: isActive
                      ? 'drop-shadow(0 0 10px rgba(0, 255, 255, 0.55))'
                      : 'drop-shadow(0 0 6px rgba(0, 212, 255, 0.18))',
                    transition:
                      'stroke 180ms cubic-bezier(0.2, 0, 0, 1), stroke-width 180ms cubic-bezier(0.2, 0, 0, 1), filter 180ms cubic-bezier(0.2, 0, 0, 1)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(event) => {
                    setHovered(route.id);
                    showTooltipAtPointer(event, routeTooltip);
                  }}
                  onMouseMove={(event) => showTooltipAtPointer(event, routeTooltip)}
                  onMouseLeave={handleLeave}
                />
              );
            })}

            {CITIES.map((city) => {
              const isActive = selected === city.id || hovered === city.id;

              return (
                <Marker key={city.id} coordinates={city.coordinates}>
                  <g
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(event) => {
                      setHovered(city.id);
                      showTooltipAtPointer(
                        event,
                        CITY_TOOLTIPS[city.id] || `${city.name} - ${ISLAND_NAMES[city.regionId]}`
                      );
                    }}
                    onMouseMove={(event) => {
                      if (hovered === city.id) {
                        showTooltipAtPointer(
                          event,
                          CITY_TOOLTIPS[city.id] || `${city.name} - ${ISLAND_NAMES[city.regionId]}`
                        );
                      }
                    }}
                    onMouseLeave={handleLeave}
                    onClick={() => setSelected((previous) => (previous === city.id ? null : city.id))}
                  >
                    <circle
                      r={isActive ? 5.5 : 4}
                      fill={isActive ? NEON_BRIGHT : NEON_ACTIVE}
                      stroke="rgba(0,0,0,0.7)"
                      strokeWidth={1.2}
                      style={{
                        filter: `drop-shadow(0 0 8px ${isActive ? NEON_BRIGHT : NEON})`,
                        transition: 'r 180ms cubic-bezier(0.2, 0, 0, 1), fill 180ms cubic-bezier(0.2, 0, 0, 1)',
                      }}
                    />
                    <circle
                      r={isActive ? 10 : 8}
                      fill="none"
                      stroke={isActive ? 'rgba(0,255,255,0.45)' : 'rgba(0,212,255,0.28)'}
                      strokeWidth={1}
                    />
                    <text
                      x={city.dx}
                      y={city.dy}
                      style={{
                        fill: isActive ? NEON_BRIGHT : '#bffcff',
                        fontSize: 10,
                        fontFamily: "'Share Tech Mono', monospace",
                        letterSpacing: '0.06em',
                        paintOrder: 'stroke',
                        stroke: 'rgba(0, 0, 0, 0.85)',
                        strokeWidth: 2,
                      }}
                    >
                      {city.name}
                    </text>
                  </g>
                </Marker>
              );
            })}
          </ZoomableGroup>
        </ComposableMap>

        {tooltip.show && (
          <div
            style={{
              ...styles.tooltip,
              left: tooltip.x + 14,
              top: tooltip.y - 36,
            }}
          >
            <span style={{ color: NEON_BRIGHT, marginRight: 6 }}>*</span>
            {tooltip.name}
          </div>
        )}
      </div>

      <div style={styles.zoomBar}>
        <button style={styles.zBtn} onClick={() => setZoom((value) => Math.min(value + 0.5, 6))}>
          +
        </button>
        <div style={styles.zTrack}>
          <div style={{ ...styles.zFill, height: `${((zoom - 1) / 5) * 100}%` }} />
        </div>
        <button style={styles.zBtn} onClick={() => setZoom((value) => Math.max(value - 0.5, 1))}>
          -
        </button>
      </div>

      {selectedLabel && (
        <div style={styles.infoPanel} key={selectedLabel}>
          <span style={styles.infoLabel}>ZONE SELECTIONNEE</span>
          <span style={styles.infoName}>{selectedLabel}</span>
          <span style={styles.infoCode}>[{selected}]</span>
        </div>
      )}

      <footer style={styles.footer}>
        <span>
          <span style={styles.dot} />
          SYSTEME ACTIF
        </span>
        <span>OCEAN INDIEN OUEST</span>
        <span>{selectedLabel ? `[${selectedLabel}]` : 'AUCUNE SELECTION'}</span>
      </footer>
    </div>
  );
}

const styles = {
  root: {
    background: '#000005',
    width: '100%',
    minHeight: 'clamp(420px, 74vh, 640px)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Share Tech Mono', monospace",
    color: NEON,
    padding: 'clamp(14px, 3vw, 24px) clamp(12px, 3vw, 24px) 20px',
    position: 'relative',
    overflow: 'hidden',
    gap: 0,
    borderRadius: 6,
  },
  scanlines: {
    position: 'absolute',
    inset: 0,
    background:
      'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,212,255,0.018) 2px,rgba(0,212,255,0.018) 4px)',
    pointerEvents: 'none',
    zIndex: 1,
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderTop: `2px solid ${NEON}`,
    borderLeft: `2px solid ${NEON}`,
    boxShadow: `0 0 8px ${NEON}`,
    zIndex: 3,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 14,
    letterSpacing: '0.18em',
    fontSize: 11,
    marginBottom: 10,
    textShadow: `0 0 12px ${NEON}`,
    zIndex: 2,
  },
  headerTitle: { opacity: 0.85 },
  blink: {
    animation: 'blink 1.8s infinite',
    color: NEON_BRIGHT,
    textShadow: `0 0 8px ${NEON_BRIGHT}`,
    fontSize: 10,
  },
  blink2: {
    animation: 'blink 1.8s 0.9s infinite',
    color: NEON_BRIGHT,
    textShadow: `0 0 8px ${NEON_BRIGHT}`,
    fontSize: 10,
  },
  mapWrap: {
    position: 'relative',
    width: '100%',
    maxWidth: 720,
    height: 'clamp(300px, 58vh, 560px)',
    filter: 'drop-shadow(0 0 30px rgba(0,180,220,0.18))',
    zIndex: 2,
  },
  tooltip: {
    position: 'absolute',
    background: 'rgba(0,0,0,0.92)',
    border: `1px solid ${NEON}`,
    boxShadow: `0 0 14px rgba(0,212,255,0.45), inset 0 0 8px rgba(0,212,255,0.05)`,
    color: NEON,
    padding: '5px 13px',
    fontSize: 11,
    letterSpacing: '0.08em',
    pointerEvents: 'none',
    whiteSpace: 'pre-line',
    lineHeight: 1.45,
    animation: 'fadeIn 160ms cubic-bezier(0.2, 0, 0, 1)',
    zIndex: 30,
  },
  zoomBar: {
    position: 'absolute',
    right: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    zIndex: 3,
  },
  zBtn: {
    background: 'transparent',
    border: `1px solid ${NEON}`,
    color: NEON,
    width: 40,
    height: 40,
    cursor: 'pointer',
    fontSize: 16,
    lineHeight: 1,
    fontFamily: 'monospace',
    boxShadow: `0 0 8px rgba(0,212,255,0.3)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zTrack: {
    width: 2,
    height: 80,
    background: 'rgba(0,212,255,0.15)',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'flex-end',
  },
  zFill: {
    width: '100%',
    background: NEON,
    boxShadow: `0 0 6px ${NEON}`,
    transition: 'height 240ms cubic-bezier(0.2, 0, 0, 1)',
  },
  infoPanel: {
    marginTop: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 14,
    background: 'rgba(0,212,255,0.04)',
    border: `1px solid rgba(0,212,255,0.28)`,
    padding: '7px 22px',
    animation: 'fadeIn 240ms cubic-bezier(0.2, 0, 0, 1)',
    zIndex: 2,
  },
  infoLabel: { fontSize: 9, opacity: 0.45, letterSpacing: '0.22em' },
  infoName: {
    fontSize: 15,
    fontFamily: "'Rajdhani', sans-serif",
    fontWeight: 700,
    letterSpacing: '0.14em',
    textShadow: `0 0 12px ${NEON}`,
    color: NEON_BRIGHT,
  },
  infoCode: { fontSize: 9, opacity: 0.4 },
  footer: {
    marginTop: 10,
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 28,
    fontSize: 9,
    opacity: 0.38,
    letterSpacing: '0.16em',
    zIndex: 2,
  },
  dot: {
    display: 'inline-block',
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: NEON,
    boxShadow: `0 0 6px ${NEON}`,
    marginRight: 6,
    animation: 'blink 2s infinite',
  },
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@300;500;700&display=swap');
  @keyframes blink {
    0%,100%{opacity:1} 50%{opacity:0.25}
  }
  @keyframes fadeIn {
    from{opacity:0;transform:translateY(-4px)}
    to{opacity:1;transform:translateY(0)}
  }
  * { box-sizing: border-box; }
  button:focus { outline: none; }
`;

export default AfricaMapExact;
