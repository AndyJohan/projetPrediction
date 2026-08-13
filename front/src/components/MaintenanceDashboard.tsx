import { useEffect, useState } from 'react';
import EquipmentRiskCard, { RiskStatusIcon } from './EquipmentRiskCard.tsx';
import type { RiskPredictionResponse } from './EquipmentRiskCard.tsx';
import {
  PREDICTION_STATUS_LABELS,
  PREDICTION_THRESHOLDS,
} from '../constants/prediction.ts';
import { httpClient } from '../services/httpClient';

type EquipmentRisk = {
  equipmentId: number;
  equipmentName: string;
  categorie: string;
  prediction: RiskPredictionResponse;
  generatedAt: string;
};

function MaintenanceDashboard() {
  const [equipmentRisks, setEquipmentRisks] = useState<EquipmentRisk[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchEquipmentRisks() {
      setLoading(true);
      setError(null);

      try {
        const response = await httpClient.get<EquipmentRisk[]>(
          '/maintenance/equipment-risks',
          {
            params: {
              limit: 12,
            },
          },
        );

        if (isMounted) {
          setEquipmentRisks(response.data);
        }
      } catch (requestError) {
        if (isMounted) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : 'Impossible de recuperer les predictions.',
          );
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchEquipmentRisks();

    return () => {
      isMounted = false;
    };
  }, []);

  async function refreshEquipmentRisks() {
    setRefreshing(true);
    setError(null);

    try {
      const response = await httpClient.post<EquipmentRisk[]>(
        '/maintenance/equipment-risks/refresh',
        null,
        {
          params: {
            limit: 12,
          },
        },
      );

      setEquipmentRisks(response.data);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Impossible d actualiser les predictions.',
      );
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="section prediction-dashboard">
      <div className="prediction-legend card">
        <span className="prediction-legend-title">Legende</span>
        <div className="prediction-legend-items">
          <div className="prediction-legend-item">
            <RiskStatusIcon status="Surveillance" />
            <span>{PREDICTION_STATUS_LABELS.Surveillance}</span>
          </div>
          <div className="prediction-legend-item">
            <RiskStatusIcon status="Risque" />
            <span>{PREDICTION_STATUS_LABELS.Risque}</span>
          </div>
        </div>
      </div>

      <header className="topbar prediction-topbar">
        <div>
          <p className="eyebrow">Maintenance predictive</p>
          <h1>Tableau de bord des risques equipements</h1>
          <p className="muted prediction-intro">
            Surveillance du risque de panne sous 15 jours avec estimation de l'intervalle probable
            lorsque le risque est eleve.
          </p>
        </div>

        <div className="prediction-actions">
          <button
            type="button"
            onClick={refreshEquipmentRisks}
            disabled={loading || refreshing}
            className="primary-button prediction-refresh-button"
          >
            {refreshing ? 'Actualisation...' : 'Actualiser les predictions'}
          </button>

          <div className="prediction-thresholds">
            Surveillance :{' '}
            <span>{(PREDICTION_THRESHOLDS.surveillance * 100).toFixed(0)}%</span>
            <span aria-hidden="true">|</span>
            Risque : <span>{(PREDICTION_THRESHOLDS.risk * 100).toFixed(0)}%</span>
          </div>
        </div>
      </header>

      {error ? (
        <div className="prediction-alert prediction-alert-error" role="alert">
          {error}
        </div>
      ) : null}

      {!error && !loading && equipmentRisks.length === 0 ? (
        <div className="prediction-empty card">
          Aucun equipement en surveillance ou a risque detecte pour le moment.
        </div>
      ) : null}

      <div className="prediction-risk-grid">
        {loading
          ? Array.from({ length: 4 }).map((_, index) => (
              <EquipmentRiskCard
                key={`loading-${index}`}
                equipmentId={index + 1}
                equipmentName="Chargement..."
                categorie="--"
                prediction={null}
                loading
              />
            ))
          : equipmentRisks.map((equipment) => (
              <EquipmentRiskCard
                key={equipment.equipmentId}
                equipmentId={equipment.equipmentId}
                equipmentName={equipment.equipmentName}
                categorie={equipment.categorie}
                prediction={equipment.prediction}
              />
            ))}
      </div>
    </section>
  );
}

export default MaintenanceDashboard;
