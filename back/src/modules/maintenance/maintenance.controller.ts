import { BadRequestException, Body, Controller, Get, Post, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Equipement } from '../../entities/equipement.entity';
import { Panne } from '../../entities/panne.entity';
import { Prediction } from '../../entities/prediction.entity';
import { MaintenanceDto } from './dto/maintenance.dto';
import { InferenceService, RiskPrediction } from './inference.service';
import {
  MAINTENANCE_RISK_THRESHOLDS,
  MAINTENANCE_STATUS,
} from './maintenance.constants';

type PanneWithTimestamp = Panne & {
  timestamp: Date;
};

type EquipmentRisk = {
  equipmentId: number;
  equipmentName: string;
  categorie: string;
  prediction: RiskPrediction;
  payload: MaintenanceDto;
};

const RECENT_PREDICTION_SCAN_LIMIT = 500;

@Controller('maintenance')
export class MaintenanceController {
  constructor(
    private readonly inferenceService: InferenceService,
    @InjectRepository(Equipement)
    private readonly equipementRepository: Repository<Equipement>,
    @InjectRepository(Panne)
    private readonly panneRepository: Repository<Panne>,
    @InjectRepository(Prediction)
    private readonly predictionRepository: Repository<Prediction>,
  ) {}

  @Get('equipment-risks')
  async getEquipmentRisks(@Query('limit') limit?: string) {
    const maxItems = this.parseLimit(limit);

    return this.getLatestRiskPredictions(maxItems);
  }

  @Post('equipment-risks/refresh')
  async refreshEquipmentRisks(
    @Query('limit') limit?: string,
    @Query('referenceDate') referenceDateQuery?: string,
  ) {
    const maxItems = this.parseLimit(limit);
    const referenceDate = await this.resolveReferenceDate(referenceDateQuery);
    const equipments = await this.equipementRepository.find({
      order: {
        nombrePannes: 'DESC',
        nomEquipement: 'ASC',
      },
    });

    const predictions: EquipmentRisk[] = [];

    for (const equipment of equipments) {
      const equipmentRisk = await this.predictStoredEquipment(equipment, referenceDate);
      await this.savePrediction(equipmentRisk.payload, equipmentRisk.prediction);
      predictions.push(equipmentRisk);
    }

    return predictions
      .filter((item) => item.prediction.triggerAlert)
      .sort(
        (left, right) =>
          right.prediction.probabilite_risque - left.prediction.probabilite_risque,
      )
      .slice(0, maxItems)
      .map(({ payload, ...item }) => ({
        ...item,
        generatedAt: payload.timestamp_reference,
      }));
  }

  @Post('predict')
  async predict(@Body() data: MaintenanceDto) {
    const sanitizedData = this.sanitizeMaintenancePayload(data);

    if (!sanitizedData.equipement_id) {
      throw new BadRequestException(
        'Le champ equipement_id est obligatoire pour sauvegarder une prediction.',
      );
    }

    const prediction = await this.inferenceService.predictEquipmentRisk(sanitizedData);
    const response = this.applyBusinessRiskLevel(prediction);

    await this.savePrediction(sanitizedData, response);

    return response;
  }

  private async predictStoredEquipment(
    equipment: Equipement,
    referenceDate: Date,
  ): Promise<EquipmentRisk> {
    const pannes = await this.panneRepository.find({
      where: {
        equipement: {
          id: equipment.id,
        },
      },
      order: {
        dates: 'ASC',
        heure: 'ASC',
      },
    });
    const payload = this.buildPayload(equipment, pannes, referenceDate);
    const prediction = await this.inferenceService.predictEquipmentRisk(payload);
    const businessPrediction = this.applyBusinessRiskLevel(prediction);

    return {
      equipmentId: equipment.id,
      equipmentName: equipment.nomEquipement,
      categorie: payload.categorie,
      prediction: businessPrediction,
      payload,
    };
  }

  private buildPayload(
    equipment: Equipement,
    pannes: Panne[],
    referenceDate: Date,
  ): MaintenanceDto {
    const day = referenceDate.getDay();
    const datedPannes = pannes
      .map((panne) => this.withTimestamp(panne))
      .filter((panne): panne is PanneWithTimestamp => Boolean(panne))
      .filter((panne) => panne.timestamp < referenceDate)
      .sort((left, right) => left.timestamp.getTime() - right.timestamp.getTime());
    const lastPanne = datedPannes.at(-1);
    const intervals = this.getIntervalsInDays(datedPannes);
    const statsIntervals = intervals.slice(0, -1);
    const pannes30j = this.countInWindow(datedPannes, referenceDate, 30);
    const pannes7j = this.countInWindow(datedPannes, referenceDate, 7);

    return {
      equipement_id: equipment.id,
      jour_semaine: day === 0 ? 6 : day - 1,
      est_weekend: day === 0 || day === 6 ? 1 : 0,
      mois: referenceDate.getMonth() + 1,
      jours_depuis_derniere_panne: lastPanne
        ? this.diffDays(lastPanne.timestamp, referenceDate)
        : 30,
      pannes_dernieres_1j: this.countInWindow(datedPannes, referenceDate, 1),
      pannes_dernieres_2j: this.countInWindow(datedPannes, referenceDate, 2),
      pannes_7_derniers_jours: pannes7j,
      pannes_14_derniers_jours: this.countInWindow(datedPannes, referenceDate, 14),
      pannes_30_derniers_jours: pannes30j,
      pannes_90_derniers_jours: this.countInWindow(datedPannes, referenceDate, 90),
      intervalle_median_pannes_jours: this.median(statsIntervals) ?? 30,
      mtbf_jours: this.average(statsIntervals) ?? 30,
      taux_panne_mois: this.failureRatePerMonth(datedPannes),
      tendance_pannes: pannes7j / 7 - pannes30j / 30,
      ...this.commentCounts(datedPannes, referenceDate),
      categorie: (equipment.categorie ?? 'Inconnue').trim().toUpperCase(),
      timestamp_reference: referenceDate.toISOString(),
    };
  }

  private applyBusinessRiskLevel(prediction: RiskPrediction): RiskPrediction {
    const isRisk = prediction.probabilite_risque >= prediction.risk_threshold;
    // Business level used by the UI: surveillance is useful before the ML risk cutoff.
    const isSurveillance =
      !isRisk &&
      prediction.probabilite_risque >= MAINTENANCE_RISK_THRESHOLDS.surveillance;

    return {
      ...prediction,
      classe_predite: isRisk ? 1 : 0,
      statut_predit: isRisk
        ? MAINTENANCE_STATUS.risk
        : isSurveillance
          ? MAINTENANCE_STATUS.surveillance
          : MAINTENANCE_STATUS.healthy,
      triggerAlert: isRisk || isSurveillance,
    };
  }

  private withTimestamp(panne: Panne): PanneWithTimestamp | null {
    if (!panne.dates) return null;

    const time = panne.heure ?? '00:00:00';
    const timestamp = new Date(`${panne.dates}T${time}`);

    if (Number.isNaN(timestamp.getTime())) return null;

    return {
      ...panne,
      timestamp,
    };
  }

  private countInWindow(
    pannes: PanneWithTimestamp[],
    referenceDate: Date,
    days: number,
  ): number {
    const windowStart = new Date(referenceDate);
    windowStart.setDate(windowStart.getDate() - days);

    return pannes.filter(
      (panne) => panne.timestamp >= windowStart && panne.timestamp < referenceDate,
    ).length;
  }

  private commentCounts(
    pannes: PanneWithTimestamp[],
    referenceDate: Date,
  ): Pick<
    MaintenanceDto,
    | 'comment_hs_30j'
    | 'comment_liaison_30j'
    | 'comment_reset_30j'
    | 'comment_sans_intervention_30j'
    | 'comment_perturbation_30j'
  > {
    const recentPannes = pannes.filter((panne) => {
      const windowStart = new Date(referenceDate);
      windowStart.setDate(windowStart.getDate() - 30);
      return panne.timestamp >= windowStart && panne.timestamp < referenceDate;
    });

    return {
      comment_hs_30j: this.countComments(recentPannes, /\b(h\/s|hs|hors service)\b/i),
      comment_liaison_30j: this.countComments(
        recentPannes,
        /(liaison|vsat|r[eé]seau|amhs|synergy|smt|aftn)/i,
      ),
      comment_reset_30j: this.countComments(
        recentPannes,
        /(reset|red[eé]marr|reboot|relance)/i,
      ),
      comment_sans_intervention_30j: this.countComments(
        recentPannes,
        /(sans intervention|ok sans)/i,
      ),
      comment_perturbation_30j: this.countComments(
        recentPannes,
        /(perturbation|intermittence|instable)/i,
      ),
    };
  }

  private countComments(pannes: PanneWithTimestamp[], pattern: RegExp): number {
    return pannes.filter((panne) => pattern.test(panne.commentaires ?? '')).length;
  }

  private getIntervalsInDays(pannes: PanneWithTimestamp[]): number[] {
    return pannes.slice(1).map((panne, index) => {
      const previous = pannes[index];
      return this.diffDays(previous.timestamp, panne.timestamp);
    });
  }

  private diffDays(startDate: Date, endDate: Date): number {
    return (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  }

  private median(values: number[]): number | null {
    if (!values.length) return null;

    const sorted = [...values].sort((left, right) => left - right);
    const middle = Math.floor(sorted.length / 2);

    if (sorted.length % 2) return sorted[middle];

    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  private average(values: number[]): number | null {
    if (!values.length) return null;

    return values.reduce((total, value) => total + value, 0) / values.length;
  }

  private failureRatePerMonth(pannes: PanneWithTimestamp[]): number {
    if (pannes.length < 2) return 0;

    const firstPanne = pannes[0];
    const lastPanne = pannes.at(-1);

    if (!lastPanne) return 0;

    const monthsSinceFirstPanne = Math.max(
      this.diffDays(firstPanne.timestamp, lastPanne.timestamp) / 30,
      1 / 30,
    );

    return (pannes.length - 1) / monthsSinceFirstPanne;
  }

  private parseLimit(limit?: string): number {
    const parsedLimit = Number(limit);

    if (!Number.isFinite(parsedLimit)) return 12;

    return Math.min(Math.max(Math.trunc(parsedLimit), 1), 50);
  }

  private async resolveReferenceDate(referenceDateQuery?: string): Promise<Date> {
    if (referenceDateQuery && referenceDateQuery !== 'latest') {
      const parsedDate = new Date(referenceDateQuery);

      if (Number.isNaN(parsedDate.getTime())) {
        throw new BadRequestException('referenceDate doit etre une date ISO valide.');
      }

      return parsedDate;
    }

    // Default to the dataset's latest panne so historical imports are evaluated in context.
    const [latestPanne] = await this.panneRepository.find({
      order: {
        dates: 'DESC',
        heure: 'DESC',
      },
      take: 1,
    });
    const latestTimestamp = latestPanne ? this.withTimestamp(latestPanne) : null;

    if (!latestTimestamp) {
      return new Date();
    }

    const referenceDate = new Date(latestTimestamp.timestamp);
    referenceDate.setSeconds(referenceDate.getSeconds() + 1);

    return referenceDate;
  }

  private async getLatestRiskPredictions(maxItems: number) {
    const recentPredictions = await this.predictionRepository.find({
      relations: {
        equipement: true,
      },
      order: {
        createdAt: 'DESC',
      },
      take: RECENT_PREDICTION_SCAN_LIMIT,
    });
    const latestByEquipment = new Map<number, Prediction>();

    for (const prediction of recentPredictions) {
      if (!prediction.equipementId || latestByEquipment.has(prediction.equipementId)) {
        continue;
      }

      // createdAt DESC guarantees the first row per equipment is the latest one.
      latestByEquipment.set(prediction.equipementId, prediction);
    }

    return [...latestByEquipment.values()]
      .filter((prediction) => prediction.triggerAlert)
      .sort(
        (left, right) => right.probabiliteRisque - left.probabiliteRisque,
      )
      .slice(0, maxItems)
      .map((prediction) => ({
        equipmentId: prediction.equipementId,
        equipmentName:
          prediction.equipement?.nomEquipement ?? `Equipement #${prediction.equipementId}`,
        categorie: prediction.categorie,
        generatedAt:
          prediction.timestampReference ?? prediction.createdAt.toISOString(),
        prediction: {
          classe_predite: prediction.classePredite,
          statut_predit: prediction.statutPredit,
          confiance: prediction.confiance,
          probabilite_risque: prediction.probabiliteRisque,
          risk_threshold: prediction.riskThreshold,
          triggerAlert: prediction.triggerAlert,
          categorie: prediction.categorie,
          estimation_prochaine_panne: prediction.intervalleId !== null
            ? {
                intervalle_id: prediction.intervalleId,
                intervalle_libelle: prediction.intervalleLibelle ?? '',
                confiance: prediction.confianceIntervalle ?? 0,
                heures_min: prediction.heuresMin ?? 0,
                heures_max: prediction.heuresMax ?? 0,
                heures_estimees: prediction.heuresEstimees ?? 0,
                date_debut: prediction.dateDebut ?? '',
                date_fin: prediction.dateFin ?? '',
                date_estimee: prediction.dateEstimee ?? '',
              }
            : null,
        },
      }));
  }

  private async savePrediction(
    data: MaintenanceDto,
    prediction: RiskPrediction,
  ): Promise<void> {
    const estimation = prediction.estimation_prochaine_panne;
    const equipementId = data.equipement_id ?? prediction.equipement_id ?? null;

    await this.predictionRepository.save(
      this.predictionRepository.create({
        equipementId,
        categorie: prediction.categorie,
        jourSemaine: data.jour_semaine,
        estWeekend: data.est_weekend,
        mois: data.mois,
        joursDepuisDernierePanne: data.jours_depuis_derniere_panne,
        pannesDernieres1j: data.pannes_dernieres_1j,
        pannesDernieres2j: data.pannes_dernieres_2j,
        pannes7DerniersJours: data.pannes_7_derniers_jours,
        pannes14DerniersJours: data.pannes_14_derniers_jours,
        pannes30DerniersJours: data.pannes_30_derniers_jours,
        pannes90DerniersJours: data.pannes_90_derniers_jours,
        intervalleMedianPannesJours: data.intervalle_median_pannes_jours,
        mtbfJours: data.mtbf_jours,
        tauxPanneMois: data.taux_panne_mois,
        tendancePannes: data.tendance_pannes,
        commentHs30j: data.comment_hs_30j,
        commentLiaison30j: data.comment_liaison_30j,
        commentReset30j: data.comment_reset_30j,
        commentSansIntervention30j: data.comment_sans_intervention_30j,
        commentPerturbation30j: data.comment_perturbation_30j,
        timestampReference: data.timestamp_reference ?? null,
        classePredite: prediction.classe_predite,
        statutPredit: prediction.statut_predit,
        confiance: prediction.confiance,
        probabiliteRisque: prediction.probabilite_risque,
        riskThreshold: prediction.risk_threshold,
        triggerAlert: prediction.triggerAlert,
        intervalleId: estimation?.intervalle_id ?? null,
        intervalleLibelle: estimation?.intervalle_libelle ?? null,
        confianceIntervalle: estimation?.confiance ?? null,
        heuresMin: estimation?.heures_min ?? null,
        heuresMax: estimation?.heures_max ?? null,
        heuresEstimees: estimation?.heures_estimees ?? null,
        dateDebut: estimation?.date_debut ?? null,
        dateFin: estimation?.date_fin ?? null,
        dateEstimee: estimation?.date_estimee ?? null,
        payload: data as unknown as Record<string, unknown>,
        resultat: {
          ...prediction,
          equipement_id: equipementId,
        } as unknown as Record<string, unknown>,
      }),
    );
  }

  private sanitizeMaintenancePayload(data: MaintenanceDto): MaintenanceDto {
    if (!data || typeof data !== 'object') {
      throw new BadRequestException('Payload maintenance invalide.');
    }

    const sanitized: MaintenanceDto = {
      equipement_id: this.optionalInteger(data.equipement_id, 'equipement_id'),
      jour_semaine: this.requiredNumber(data.jour_semaine, 'jour_semaine'),
      est_weekend: this.requiredBinary(data.est_weekend, 'est_weekend'),
      mois: this.requiredRange(data.mois, 'mois', 1, 12),
      jours_depuis_derniere_panne: this.requiredNumber(
        data.jours_depuis_derniere_panne,
        'jours_depuis_derniere_panne',
      ),
      pannes_dernieres_1j: this.requiredNumber(data.pannes_dernieres_1j, 'pannes_dernieres_1j'),
      pannes_dernieres_2j: this.requiredNumber(data.pannes_dernieres_2j, 'pannes_dernieres_2j'),
      pannes_7_derniers_jours: this.requiredNumber(
        data.pannes_7_derniers_jours,
        'pannes_7_derniers_jours',
      ),
      pannes_14_derniers_jours: this.requiredNumber(
        data.pannes_14_derniers_jours,
        'pannes_14_derniers_jours',
      ),
      pannes_30_derniers_jours: this.requiredNumber(
        data.pannes_30_derniers_jours,
        'pannes_30_derniers_jours',
      ),
      pannes_90_derniers_jours: this.requiredNumber(
        data.pannes_90_derniers_jours,
        'pannes_90_derniers_jours',
      ),
      intervalle_median_pannes_jours: this.requiredNumber(
        data.intervalle_median_pannes_jours,
        'intervalle_median_pannes_jours',
      ),
      mtbf_jours: this.requiredNumber(data.mtbf_jours, 'mtbf_jours'),
      taux_panne_mois: this.requiredNumber(data.taux_panne_mois, 'taux_panne_mois'),
      tendance_pannes: this.requiredNumber(data.tendance_pannes, 'tendance_pannes'),
      comment_hs_30j: this.requiredNumber(data.comment_hs_30j, 'comment_hs_30j'),
      comment_liaison_30j: this.requiredNumber(data.comment_liaison_30j, 'comment_liaison_30j'),
      comment_reset_30j: this.requiredNumber(data.comment_reset_30j, 'comment_reset_30j'),
      comment_sans_intervention_30j: this.requiredNumber(
        data.comment_sans_intervention_30j,
        'comment_sans_intervention_30j',
      ),
      comment_perturbation_30j: this.requiredNumber(
        data.comment_perturbation_30j,
        'comment_perturbation_30j',
      ),
      categorie: this.requiredCategory(data.categorie),
      timestamp_reference: this.optionalIsoDate(data.timestamp_reference),
    };

    return sanitized;
  }

  private requiredNumber(value: unknown, field: string) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new BadRequestException(`Le champ ${field} doit etre un nombre fini.`);
    }

    return value;
  }

  private requiredRange(value: unknown, field: string, min: number, max: number) {
    const numberValue = this.requiredNumber(value, field);
    if (numberValue < min || numberValue > max) {
      throw new BadRequestException(`Le champ ${field} doit etre entre ${min} et ${max}.`);
    }

    return numberValue;
  }

  private requiredBinary(value: unknown, field: string) {
    const numberValue = this.requiredNumber(value, field);
    if (![0, 1].includes(numberValue)) {
      throw new BadRequestException(`Le champ ${field} doit valoir 0 ou 1.`);
    }

    return numberValue;
  }

  private optionalInteger(value: unknown, field: string) {
    if (value === undefined || value === null) {
      return undefined;
    }

    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
      throw new BadRequestException(`Le champ ${field} doit etre un entier positif.`);
    }

    return value;
  }

  private requiredCategory(value: unknown) {
    if (typeof value !== 'string') {
      throw new BadRequestException('Le champ categorie doit etre une chaine.');
    }

    const category = value.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,20}$/.test(category)) {
      throw new BadRequestException('Le champ categorie contient des caracteres non autorises.');
    }

    return category;
  }

  private optionalIsoDate(value: unknown) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (typeof value !== 'string') {
      throw new BadRequestException('timestamp_reference doit etre une date ISO.');
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('timestamp_reference doit etre une date ISO valide.');
    }

    return parsed.toISOString();
  }
}
