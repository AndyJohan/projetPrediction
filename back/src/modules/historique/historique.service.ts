import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Panne } from '../../entities/panne.entity';
import { SummaryQueryDto } from './dto/summary-query.dto';

@Injectable()
export class HistoriqueService {
  constructor(
    @InjectRepository(Panne)
    private readonly panneRepository: Repository<Panne>,
  ) {}

  async getSummary(query: SummaryQueryDto) {
    const period = await this.resolvePeriod(query.period);
    const category = this.normalizeCategory(query.category);

    if (!period) {
      return {
        period: null,
        trend: [],
        categoryBreakdown: [],
        pannesParEquipement: [],
        dernierIncident: null,
      };
    }

    const [trend, categoryBreakdown, pannesParEquipement, dernierIncident] = await Promise.all([
      this.getTrend(period, category),
      this.getCategoryBreakdown(period),
      this.getPannesParEquipement(period, category),
      this.getDernierIncident(period, category),
    ]);

    return {
      period,
      trend,
      categoryBreakdown,
      pannesParEquipement,
      dernierIncident,
    };
  }

  async getDetails(query: SummaryQueryDto) {
    const period = await this.resolvePeriod(query.period);
    const category = this.normalizeCategory(query.category);

    if (!period) {
      return [];
    }

    const rowsQuery = this.panneRepository
      .createQueryBuilder('panne')
      .innerJoin('panne.equipement', 'equipement')
      .select('equipement.nomEquipement', 'equipement')
      .addSelect('equipement.categorie', 'categorie')
      .addSelect("TO_CHAR(panne.dates, 'YYYY-MM-DD')", 'date')
      .addSelect('panne.heure', 'heure')
      .addSelect('panne.commentaires', 'commentaires')
      .where("date_trunc('month', panne.dates) = :period", { period });

    if (category) {
      rowsQuery.andWhere('equipement.categorie = :category', { category });
    }

    const rows = await rowsQuery
      .orderBy('panne.dates', 'DESC')
      .addOrderBy('panne.heure', 'DESC')
      .limit(50)
      .getRawMany<{
        equipement: string;
        categorie: string | null;
        date: string;
        heure: string | null;
        commentaires: string | null;
      }>();

    return rows.map((row) => ({
      equipement: row.equipement,
      categorie: row.categorie ?? null,
      date: row.date,
      heure: row.heure ?? null,
      commentaires: row.commentaires ?? null,
    }));
  }

  private async resolvePeriod(period?: string) {
    if (period?.trim()) {
      const cleaned = period.trim();

      if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(cleaned)) {
        throw new BadRequestException('La periode doit respecter le format YYYY-MM.');
      }

      return `${cleaned}-01`;
    }

    const row = await this.panneRepository
      .createQueryBuilder('panne')
      .select("date_trunc('month', panne.dates)", 'period')
      .where('panne.dates IS NOT NULL')
      .orderBy('period', 'DESC')
      .limit(1)
      .getRawOne<{ period: string }>();

    return row?.period ?? null;
  }

  private async getTrend(period: string, category?: string | null) {
    const rowsQuery = this.panneRepository
      .createQueryBuilder('panne')
      .innerJoin('panne.equipement', 'equipement')
      .select('EXTRACT(DAY FROM panne.dates)', 'day')
      .addSelect('COUNT(*)', 'value')
      .where("date_trunc('month', panne.dates) = :period", { period });

    if (category) {
      rowsQuery.andWhere('equipement.categorie = :category', { category });
    }

    const rows = await rowsQuery
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany<{ day: string; value: string }>();

    return rows.map((row) => ({
      label: String(row.day).padStart(2, '0'),
      value: Number(row.value),
    }));
  }

  private async getPannesParEquipement(period: string, category?: string | null) {
    const rowsQuery = this.panneRepository
      .createQueryBuilder('panne')
      .innerJoin('panne.equipement', 'equipement')
      .select('equipement.nomEquipement', 'equipement')
      .addSelect('COUNT(*)', 'pannes')
      .where("date_trunc('month', panne.dates) = :period", { period });

    if (category) {
      rowsQuery.andWhere('equipement.categorie = :category', { category });
    }

    const rows = await rowsQuery
      .groupBy('equipement.nomEquipement')
      .orderBy('COUNT(*)', 'DESC')
      .limit(5)
      .getRawMany<{ equipement: string; pannes: string }>();

    return rows.map((row) => ({
      equipement: row.equipement,
      pannes: Number(row.pannes),
    }));
  }

  private async getCategoryBreakdown(period: string) {
    const rows = await this.panneRepository
      .createQueryBuilder('panne')
      .innerJoin('panne.equipement', 'equipement')
      .select('COALESCE(equipement.categorie, :fallback)', 'label')
      .addSelect('COUNT(*)', 'count')
      .where("date_trunc('month', panne.dates) = :period", { period })
      .setParameter('fallback', 'NON RENSEIGNEE')
      .groupBy('COALESCE(equipement.categorie, :fallback)')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany<{ label: string; count: string }>();

    const total = rows.reduce((sum, row) => sum + Number(row.count), 0);
    const colors = ['var(--mint)', 'var(--peach)', 'var(--berry)', 'var(--slate)', '#7dd3fc'];

    return rows.map((row, index) => ({
      label: row.label,
      value: total ? Math.round((Number(row.count) / total) * 100) : 0,
      count: Number(row.count),
      color: colors[index % colors.length],
    }));
  }

  private async getDernierIncident(period: string, category?: string | null) {
    const rowQuery = this.panneRepository
      .createQueryBuilder('panne')
      .innerJoin('panne.equipement', 'equipement')
      .select('equipement.nomEquipement', 'equipement')
      .addSelect('equipement.categorie', 'categorie')
      .addSelect("TO_CHAR(panne.dates, 'YYYY-MM-DD')", 'date')
      .addSelect('panne.heure', 'heure')
      .addSelect('panne.commentaires', 'commentaires')
      .where("date_trunc('month', panne.dates) = :period", { period });

    if (category) {
      rowQuery.andWhere('equipement.categorie = :category', { category });
    }

    const row = await rowQuery
      .orderBy('panne.dates', 'DESC')
      .addOrderBy('panne.heure', 'DESC')
      .limit(1)
      .getRawOne<{
        equipement: string;
        categorie: string | null;
        date: string;
        heure: string | null;
        commentaires: string | null;
      }>();

    if (!row) {
      return null;
    }

    return {
      equipement: row.equipement,
      categorie: row.categorie ?? null,
      date: row.date,
      heure: row.heure ?? null,
      commentaires: row.commentaires ?? null,
    };
  }

  private normalizeCategory(category?: string) {
    const cleaned = String(category ?? '').trim();
    if (!cleaned || cleaned === 'ALL') {
      return null;
    }

    const normalized = cleaned.toUpperCase();
    if (!['COM', 'SURV', 'MET', 'RESEAU'].includes(normalized)) {
      throw new BadRequestException('Categorie historique invalide.');
    }

    return normalized;
  }
}
