export class MaintenanceDto {
  equipement_id?: number;
  jour_semaine: number;
  est_weekend: number;
  mois: number;
  jours_depuis_derniere_panne: number;
  pannes_dernieres_1j: number;
  pannes_dernieres_2j: number;
  pannes_7_derniers_jours: number;
  pannes_14_derniers_jours: number;
  pannes_30_derniers_jours: number;
  pannes_90_derniers_jours: number;
  intervalle_median_pannes_jours: number;
  mtbf_jours: number;
  taux_panne_mois: number;
  tendance_pannes: number;
  comment_hs_30j: number;
  comment_liaison_30j: number;
  comment_reset_30j: number;
  comment_sans_intervention_30j: number;
  comment_perturbation_30j: number;
  categorie: string;
  timestamp_reference?: string;
}
