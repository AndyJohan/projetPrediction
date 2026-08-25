import {
  PREDICTION_STATUS_LABELS,
  PREDICTION_THRESHOLDS,
} from '../constants/prediction.ts';

type EquipmentRiskCardProps = {
  equipmentId: number;
  categorie: string;
  equipmentName?: string;
  prediction: RiskPredictionResponse | null;
  loading?: boolean;
  error?: string | null;
};

type FailureEstimate = {
  intervalle_id: number;
  intervalle_libelle: string;
  confiance: number;
  heures_min: number;
  heures_max: number;
  heures_estimees: number;
  date_debut: string;
  date_fin: string;
  date_estimee: string;
};

type CardStatus = 'risk' | 'surveillance' | 'healthy' | 'neutral';

export type RiskPredictionResponse = {
  classe_predite: number;
  statut_predit: 'Sain' | 'Surveillance' | 'Risque' | string;
  confiance: number;
  probabilite_risque: number;
  risk_threshold: number;
  triggerAlert: boolean;
  categorie: string;
  estimation_prochaine_panne: FailureEstimate | null;
};

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatDate(value?: string): string {
  if (!value) return '--';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

function getRiskColor(probability: number): string {
  if (probability >= PREDICTION_THRESHOLDS.risk) return 'risk';
  if (probability >= PREDICTION_THRESHOLDS.surveillance) return 'surveillance';
  return 'healthy';
}

function getCardStatus(
  status: string,
  prediction: RiskPredictionResponse | null,
): CardStatus {
  if (status === 'Risque') return 'risk';
  if (status === 'Surveillance' || Boolean(prediction?.triggerAlert)) return 'surveillance';
  return 'healthy';
}

function getStatusLabel(cardStatus: CardStatus): string {
  if (cardStatus === 'risk') return PREDICTION_STATUS_LABELS.Risque;
  if (cardStatus === 'surveillance') return PREDICTION_STATUS_LABELS.Surveillance;
  if (cardStatus === 'neutral') return 'Analyse';
  return 'Sain';
}

function EquipmentRiskCard({
  equipmentId,
  categorie,
  equipmentName,
  prediction,
  loading = false,
  error = null,
}: EquipmentRiskCardProps) {
  const riskProbability = prediction?.probabilite_risque ?? 0;
  const status = prediction?.statut_predit ?? 'Sain';
  const progressColor = getRiskColor(riskProbability);
  const estimate = prediction?.estimation_prochaine_panne ?? null;
  const cardStatus: CardStatus = loading ? 'neutral' : getCardStatus(status, prediction);
  const statusLabel = getStatusLabel(cardStatus);
  const hasElevatedStatus = cardStatus === 'risk' || cardStatus === 'surveillance';

  return (
    <article className={`equipment-risk-card card ${cardStatus}`}>
      <div className="equipment-risk-card-header">
        <div className="equipment-risk-card-title">
          <div className="equipment-risk-card-meta">
            <p className="equipment-kicker">Equipement #{equipmentId}</p>
            <span className={`risk-status-chip ${cardStatus}`} title={statusLabel}>
              <span className="risk-status-dot" aria-hidden="true" />
              <span>{statusLabel}</span>
            </span>
          </div>
          <h3>{equipmentName ?? `Machine ${equipmentId}`}</h3>
          <p className="muted">Categorie {categorie}</p>
        </div>
      </div>

      {error ? (
        <div className="prediction-alert prediction-alert-error" role="alert">
          {error}
        </div>
      ) : (
        <div className="equipment-risk-card-body">
          <div>
            <div className="risk-meter-label">
              <span>Probabilite de risque</span>
              <strong>{loading ? '--' : formatPercent(riskProbability)}</strong>
            </div>
            <div className="risk-meter-track" aria-hidden="true">
              <div
                className={`risk-meter-fill ${progressColor}`}
                style={{ width: `${Math.min(riskProbability * 100, 100)}%` }}
              />
            </div>
          </div>

          <p className="risk-card-note">
            Fiabilite de la prediction :{' '}
            <strong>{loading || !prediction ? '--' : formatPercent(prediction.confiance)}</strong>
          </p>

          {estimate ? (
            <div className="risk-estimate risk">
              <p className="risk-estimate-title">Estimation prochaine panne</p>
              <p>{estimate.intervalle_libelle}</p>
              <p>
                Date estimee : <strong>{formatDate(estimate.date_estimee)}</strong>
              </p>
              <p className="risk-estimate-foot">
                Fenetre : {formatDate(estimate.date_debut)} - {formatDate(estimate.date_fin)}
              </p>
            </div>
          ) : (
            <div className="risk-estimate neutral">
              {hasElevatedStatus
                ? 'Surveillance recommandee, sans fenetre de panne confirmee sous 15 jours.'
                : 'Aucune panne estimee sous 15 jours.'}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default EquipmentRiskCard;
