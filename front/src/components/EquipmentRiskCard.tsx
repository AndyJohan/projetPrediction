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
    timeStyle: 'short',
  }).format(new Date(value));
}

function getRiskColor(probability: number): string {
  if (probability >= PREDICTION_THRESHOLDS.risk) return 'risk';
  if (probability >= PREDICTION_THRESHOLDS.surveillance) return 'surveillance';
  return 'healthy';
}

type RiskStatusIconProps = {
  status: 'Surveillance' | 'Risque';
  pulse?: boolean;
  withLabel?: boolean;
};

export function RiskStatusIcon({
  status,
  pulse = false,
  withLabel = false,
}: RiskStatusIconProps) {
  const isRisk = status === 'Risque';
  const label = isRisk
    ? PREDICTION_STATUS_LABELS.Risque
    : PREDICTION_STATUS_LABELS.Surveillance;
  const statusClass = isRisk ? 'risk' : 'surveillance';

  return (
    <span
      aria-label={label}
      title={label}
      className={`risk-status-icon ${statusClass}${pulse ? ' is-pulsing' : ''}`}
    >
      {isRisk ? (
        <svg
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.2"
          viewBox="0 0 24 24"
        >
          <path d="M12 3 22 20H2L12 3Z" />
          <path d="M12 9v5" />
          <path d="M12 17h.01" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.2"
          viewBox="0 0 24 24"
        >
          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
      {withLabel ? <span>{label}</span> : null}
    </span>
  );
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
  const isRisk = status === 'Risque';
  const isSurveillance = status === 'Surveillance' || Boolean(prediction?.triggerAlert);
  const progressColor = getRiskColor(riskProbability);
  const estimate = prediction?.estimation_prochaine_panne ?? null;
  const cardStatus = isRisk ? 'risk' : isSurveillance ? 'surveillance' : 'healthy';

  return (
    <article className={`equipment-risk-card card ${cardStatus}`}>
      <div className="equipment-risk-card-header">
        <div className="equipment-risk-card-title">
          <p className="equipment-kicker">Equipement #{equipmentId}</p>
          <h3>{equipmentName ?? `Machine ${equipmentId}`}</h3>
          <p className="muted">Categorie {categorie}</p>
        </div>

        {loading ? (
          <span className="risk-status-pill neutral">
            Analyse...
          </span>
        ) : isRisk ? (
          <RiskStatusIcon status="Risque" pulse />
        ) : isSurveillance ? (
          <RiskStatusIcon status="Surveillance" />
        ) : (
          <span className="risk-status-pill healthy">
            EQUIPEMENT SAIN
          </span>
        )}
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
              {isSurveillance
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
