import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Panne } from '../../entities/panne.entity';

type AssistantContextOptions = {
  period?: string;
  category?: string;
};

type CommentRow = {
  equipement: string;
  date: string;
  heure: string;
  commentaires: string;
};

type ParsedCommentInsights = {
  frequentSignals: string[];
  frequentActions: string[];
  probableCauses: string[];
  appliedSolutions: string[];
  structuredCauseExamples: string[];
  structuredSolutionExamples: string[];
  recentCommentSummaries: string[];
};

const CAUSE_KEYWORDS = [
  'source',
  'cause',
  'suite a',
  'du a',
  'probleme',
  'anomalie',
  'defaut',
  'perte image',
  'pas d image',
  'coupure',
  'liaison indisponible',
  'connectique',
  'cable',
  'imprimante',
  'synergie',
  'alimentation',
  'secteur',
];

const ACTION_KEYWORDS = [
  'solution',
  'action',
  'reset',
  'redemarrage',
  'reconfiguration',
  'verification',
  'verifier',
  'remplacement',
  'reprise service',
  'basculement',
  'maintenance',
  'relance',
  'reparer',
  'corrige',
  'resolu',
];

@Injectable()
export class AssistantContextService {
  constructor(
    @InjectRepository(Panne)
    private readonly panneRepository: Repository<Panne>,
  ) {}

  async buildContext(options: AssistantContextOptions) {
    const period = await this.resolvePeriod(options.period);
    const category = this.normalizeCategory(options.category);

    if (!period) {
      return {
        period: null,
        category,
        summary: "Aucune panne n'est disponible dans la base pour construire un contexte metier.",
      };
    }

    const [
      availableRange,
      totalPannes,
      distinctEquipments,
      topEquipments,
      categoryBreakdown,
      recentIncidents,
      commentRows,
    ] = await Promise.all([
      this.getAvailableRange(),
      this.getTotalPannes(period, category),
      this.getDistinctEquipments(period, category),
      this.getTopEquipments(period, category),
      this.getCategoryBreakdown(period),
      this.getRecentIncidents(period, category),
      this.getCommentRows(period, category),
    ]);

    const commentInsights = this.buildCommentInsights(commentRows);

    const summary = [
      `Plage de donnees disponible : ${availableRange ?? 'inconnue'}`,
      `Periode analysee : ${period.slice(0, 7)}`,
      `Categorie active : ${category ?? 'TOUTES LES CATEGORIES'}`,
      `Nombre total de pannes : ${totalPannes}`,
      `Nombre d'equipements touches : ${distinctEquipments}`,
      `Top equipements : ${topEquipments.length ? topEquipments.join(' | ') : 'aucune donnee'}`,
      `Repartition par categorie : ${categoryBreakdown.length ? categoryBreakdown.join(' | ') : 'aucune donnee'}`,
      `Derniers incidents : ${recentIncidents.length ? recentIncidents.join(' | ') : 'aucune donnee'}`,
      `Causes ou signaux recurrentes : ${commentInsights.frequentSignals.length ? commentInsights.frequentSignals.join(' | ') : 'aucune tendance claire'}`,
      `Solutions ou actions recurrentes : ${commentInsights.frequentActions.length ? commentInsights.frequentActions.join(' | ') : 'aucune solution recurrente claire'}`,
      'Commentaires libres : masques avant envoi au fournisseur IA.',
    ].join('\n');

    return {
      period,
      category,
      availableRange,
      summary,
    };
  }

  private async resolvePeriod(period?: string) {
    if (period?.trim()) {
      return `${period.trim()}-01`;
    }

    const row = await this.panneRepository
      .createQueryBuilder('panne')
      .select("TO_CHAR(date_trunc('month', panne.dates), 'YYYY-MM-DD')", 'period')
      .where('panne.dates IS NOT NULL')
      .orderBy("date_trunc('month', panne.dates)", 'DESC')
      .limit(1)
      .getRawOne<{ period: string }>();

    return row?.period ?? null;
  }

  private normalizeCategory(category?: string) {
    const cleaned = String(category ?? '').trim();
    if (!cleaned || cleaned === 'ALL') {
      return null;
    }

    return cleaned.toUpperCase();
  }

  private async getAvailableRange() {
    const row = await this.panneRepository
      .createQueryBuilder('panne')
      .select("TO_CHAR(MIN(panne.dates), 'YYYY-MM')", 'firstPeriod')
      .addSelect("TO_CHAR(MAX(panne.dates), 'YYYY-MM')", 'lastPeriod')
      .where('panne.dates IS NOT NULL')
      .getRawOne<{ firstPeriod: string | null; lastPeriod: string | null }>();

    if (!row?.firstPeriod || !row?.lastPeriod) {
      return null;
    }

    if (row.firstPeriod === row.lastPeriod) {
      return row.firstPeriod;
    }

    return `${row.firstPeriod} a ${row.lastPeriod}`;
  }

  private buildBaseQuery(period: string, category?: string | null) {
    const query = this.panneRepository
      .createQueryBuilder('panne')
      .innerJoin('panne.equipement', 'equipement')
      .where("date_trunc('month', panne.dates) = :period", { period });

    if (category) {
      query.andWhere('equipement.categorie = :category', { category });
    }

    return query;
  }

  private async getTotalPannes(period: string, category?: string | null) {
    return this.buildBaseQuery(period, category).getCount();
  }

  private async getDistinctEquipments(period: string, category?: string | null) {
    const row = await this.buildBaseQuery(period, category)
      .select('COUNT(DISTINCT equipement.ID)', 'value')
      .getRawOne<{ value: string }>();

    return Number(row?.value ?? 0);
  }

  private async getTopEquipments(period: string, category?: string | null) {
    const rows = await this.buildBaseQuery(period, category)
      .select('equipement.nomEquipement', 'equipement')
      .addSelect('COUNT(*)', 'pannes')
      .groupBy('equipement.ID')
      .addGroupBy('equipement.nomEquipement')
      .orderBy('COUNT(*)', 'DESC')
      .limit(3)
      .getRawMany<{ equipement: string; pannes: string }>();

    return rows.map((row) => `${row.equipement} (${Number(row.pannes)})`);
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
      .limit(4)
      .getRawMany<{ label: string; count: string }>();

    return rows.map((row) => `${row.label} (${Number(row.count)})`);
  }

  private async getRecentIncidents(period: string, category?: string | null) {
    const rows = await this.buildBaseQuery(period, category)
      .select('equipement.nomEquipement', 'equipement')
      .addSelect("TO_CHAR(panne.dates, 'YYYY-MM-DD')", 'date')
      .addSelect("COALESCE(TO_CHAR(panne.heure, 'HH24:MI:SS'), :fallback)", 'heure')
      .addSelect('COALESCE(panne.commentaires, :noComment)', 'commentaires')
      .setParameter('fallback', 'heure non renseignee')
      .setParameter('noComment', 'sans commentaire')
      .orderBy('panne.dates', 'DESC')
      .addOrderBy('panne.heure', 'DESC')
      .limit(3)
      .getRawMany<CommentRow>();

    return rows.map((row) => `${row.date} ${row.heure} - ${row.equipement}`);
  }

  private async getCommentRows(period: string, category?: string | null) {
    return this.buildBaseQuery(period, category)
      .select('equipement.nomEquipement', 'equipement')
      .addSelect("TO_CHAR(panne.dates, 'YYYY-MM-DD')", 'date')
      .addSelect("COALESCE(TO_CHAR(panne.heure, 'HH24:MI:SS'), :fallback)", 'heure')
      .addSelect('COALESCE(panne.commentaires, :noComment)', 'commentaires')
      .setParameter('fallback', 'heure non renseignee')
      .setParameter('noComment', 'sans commentaire')
      .orderBy('panne.dates', 'DESC')
      .addOrderBy('panne.heure', 'DESC')
      .limit(40)
      .getRawMany<CommentRow>();
  }

  private buildCommentInsights(rows: CommentRow[]): ParsedCommentInsights {
    const normalizedRows = rows
      .map((row) => ({
        ...row,
        normalizedComment: this.normalizeComment(row.commentaires),
      }))
      .filter((row) => row.normalizedComment && row.normalizedComment !== 'sans commentaire');

    const recentCommentSummaries = normalizedRows
      .slice(0, 5)
      .map((row) => `${row.date} - ${row.equipement} - ${row.normalizedComment}`);
    const structuredPairs = normalizedRows
      .map((row) => ({
        ...row,
        structured: this.extractStructuredSourceAndSolution(row.normalizedComment),
      }))
      .filter((row) => row.structured.source || row.structured.solution);
    const extractedCauses = normalizedRows.flatMap((row) =>
      this.extractCommentFragments(row.normalizedComment, CAUSE_KEYWORDS),
    );
    const extractedSolutions = normalizedRows.flatMap((row) =>
      this.extractCommentFragments(row.normalizedComment, ACTION_KEYWORDS),
    );

    return {
      frequentSignals: this.extractKeywordFrequency(normalizedRows, CAUSE_KEYWORDS),
      frequentActions: this.extractKeywordFrequency(normalizedRows, ACTION_KEYWORDS),
      probableCauses: this.extractFragmentFrequency(extractedCauses),
      appliedSolutions: this.extractFragmentFrequency(extractedSolutions),
      structuredCauseExamples: structuredPairs
        .filter((row) => row.structured.source)
        .slice(0, 5)
        .map((row) => `${row.equipement}: ${row.structured.source}`),
      structuredSolutionExamples: structuredPairs
        .filter((row) => row.structured.solution)
        .slice(0, 5)
        .map((row) => `${row.equipement}: ${row.structured.solution}`),
      recentCommentSummaries,
    };
  }

  private extractKeywordFrequency(
    rows: Array<CommentRow & { normalizedComment: string }>,
    keywords: string[],
  ) {
    const counts = new Map<string, number>();

    rows.forEach((row) => {
      keywords.forEach((keyword) => {
        if (this.normalizeForSearch(row.normalizedComment).includes(this.normalizeForSearch(keyword))) {
          counts.set(keyword, (counts.get(keyword) ?? 0) + 1);
        }
      });
    });

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([keyword, count]) => `${keyword} (${count})`);
  }

  private extractFragmentFrequency(fragments: string[]) {
    const counts = new Map<string, number>();

    fragments.forEach((fragment) => {
      const cleaned = fragment.trim();
      if (!cleaned) {
        return;
      }

      counts.set(cleaned, (counts.get(cleaned) ?? 0) + 1);
    });

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([fragment, count]) => `${fragment} (${count})`);
  }

  private extractCommentFragments(comment: string, keywords: string[]) {
    const chunks = comment
      .split(/[;|]/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    const matchedChunks = chunks.filter((chunk) =>
      keywords.some((keyword) =>
        this.normalizeForSearch(chunk).includes(this.normalizeForSearch(keyword)),
      ),
    );

    if (matchedChunks.length) {
      return matchedChunks.map((chunk) => this.sanitizeFragment(chunk));
    }

    const normalizedComment = this.normalizeForSearch(comment);
    if (keywords.some((keyword) => normalizedComment.includes(this.normalizeForSearch(keyword)))) {
      return [this.sanitizeFragment(comment)];
    }

    return [];
  }

  private extractStructuredSourceAndSolution(comment: string) {
    const compactComment = comment.replace(/\s+/g, ' ').trim();
    const sourceMatch = compactComment.match(
      /(?:source|cause)\s*[:\-]\s*(.*?)(?=(?:solution|action)\s*[:\-]|$)/i,
    );
    const solutionMatch = compactComment.match(/(?:solution|action)\s*[:\-]\s*(.*?)(?=$)/i);

    return {
      source: sourceMatch?.[1] ? this.sanitizeFragment(sourceMatch[1]) : null,
      solution: solutionMatch?.[1] ? this.sanitizeFragment(solutionMatch[1]) : null,
    };
  }

  private sanitizeFragment(value: string) {
    return value
      .replace(/\s+/g, ' ')
      .replace(/^[-:,\s]+/, '')
      .replace(/\s+[-:,]+$/, '')
      .trim();
  }

  private normalizeComment(value: string) {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .replace(/\s*;\s*/g, ' ; ')
      .trim();
  }

  private normalizeForSearch(value: string) {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
