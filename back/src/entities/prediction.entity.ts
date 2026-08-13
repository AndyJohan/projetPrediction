import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Equipement } from './equipement.entity';

@Entity({ name: 'predictions' })
export class Prediction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'equipement_id', type: 'int', nullable: true })
  equipementId: number | null;

  @ManyToOne(() => Equipement, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'equipement_id' })
  equipement: Equipement | null;

  @Column({ type: 'varchar', length: 100 })
  categorie: string;

  @Column({ name: 'jour_semaine', type: 'double precision' })
  jourSemaine: number;

  @Column({ name: 'est_weekend', type: 'double precision' })
  estWeekend: number;

  @Column({ type: 'double precision' })
  mois: number;

  @Column({ name: 'jours_depuis_derniere_panne', type: 'double precision' })
  joursDepuisDernierePanne: number;

  @Column({ name: 'pannes_dernieres_1j', type: 'double precision' })
  pannesDernieres1j: number;

  @Column({ name: 'pannes_dernieres_2j', type: 'double precision' })
  pannesDernieres2j: number;

  @Column({ name: 'pannes_7_derniers_jours', type: 'double precision' })
  pannes7DerniersJours: number;

  @Column({ name: 'pannes_14_derniers_jours', type: 'double precision' })
  pannes14DerniersJours: number;

  @Column({ name: 'pannes_30_derniers_jours', type: 'double precision' })
  pannes30DerniersJours: number;

  @Column({ name: 'pannes_90_derniers_jours', type: 'double precision' })
  pannes90DerniersJours: number;

  @Column({ name: 'intervalle_median_pannes_jours', type: 'double precision' })
  intervalleMedianPannesJours: number;

  @Column({ name: 'mtbf_jours', type: 'double precision' })
  mtbfJours: number;

  @Column({ name: 'taux_panne_mois', type: 'double precision' })
  tauxPanneMois: number;

  @Column({ name: 'tendance_pannes', type: 'double precision' })
  tendancePannes: number;

  @Column({ name: 'comment_hs_30j', type: 'double precision' })
  commentHs30j: number;

  @Column({ name: 'comment_liaison_30j', type: 'double precision' })
  commentLiaison30j: number;

  @Column({ name: 'comment_reset_30j', type: 'double precision' })
  commentReset30j: number;

  @Column({ name: 'comment_sans_intervention_30j', type: 'double precision' })
  commentSansIntervention30j: number;

  @Column({ name: 'comment_perturbation_30j', type: 'double precision' })
  commentPerturbation30j: number;

  @Column({ name: 'timestamp_reference', type: 'timestamp', nullable: true })
  timestampReference: string | null;

  @Column({ name: 'classe_predite', type: 'int' })
  classePredite: number;

  @Column({ name: 'statut_predit', type: 'varchar', length: 50 })
  statutPredit: string;

  @Column({ type: 'double precision' })
  confiance: number;

  @Column({ name: 'probabilite_risque', type: 'double precision' })
  probabiliteRisque: number;

  @Column({ name: 'risk_threshold', type: 'double precision' })
  riskThreshold: number;

  @Column({ name: 'trigger_alert', type: 'boolean' })
  triggerAlert: boolean;

  @Column({ name: 'intervalle_id', type: 'int', nullable: true })
  intervalleId: number | null;

  @Column({ name: 'intervalle_libelle', type: 'varchar', length: 100, nullable: true })
  intervalleLibelle: string | null;

  @Column({ name: 'confiance_intervalle', type: 'double precision', nullable: true })
  confianceIntervalle: number | null;

  @Column({ name: 'heures_min', type: 'double precision', nullable: true })
  heuresMin: number | null;

  @Column({ name: 'heures_max', type: 'double precision', nullable: true })
  heuresMax: number | null;

  @Column({ name: 'heures_estimees', type: 'double precision', nullable: true })
  heuresEstimees: number | null;

  @Column({ name: 'date_debut', type: 'timestamp', nullable: true })
  dateDebut: string | null;

  @Column({ name: 'date_fin', type: 'timestamp', nullable: true })
  dateFin: string | null;

  @Column({ name: 'date_estimee', type: 'timestamp', nullable: true })
  dateEstimee: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  resultat: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
