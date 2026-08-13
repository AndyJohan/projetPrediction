import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as xlsx from 'xlsx';
import { FRENCH_MONTHS, IMPORT_STATUS } from '../../common/constants/import.constants';
import {
  buildIsoDate,
  isValidCalendarDate,
  normalizeText,
  parseExcelTime,
} from '../../common/utils/import.utils';
import { Equipement } from '../../entities/equipement.entity';
import { Panne } from '../../entities/panne.entity';
import { ImportOptionsDto } from './dto/import-options.dto';

type ParsedEquipement = {
  name: string;
  heureIndex: number;
  panneIndex: number;
};

type HeaderMapping = {
  equipements: ParsedEquipement[];
  dataStartIndex: number;
};

const PANNE_HEADERS = ['panne', 'pannes'];
const HEURE_HEADERS = ['heure'];
const ALLOWED_CATEGORIES = new Set(['COM', 'SURV', 'MET', 'RESEAU', 'AUTRE']);
const MAX_SHEETS = 24;
const MAX_ROWS_PER_SHEET = 1500;
const MAX_COLUMNS_PER_ROW = 300;
const MAX_COMMENT_LENGTH = 1000;
const MAX_EQUIPMENT_NAME_LENGTH = 120;

@Injectable()
export class ImportService {
  private readonly logger = new Logger(ImportService.name);

  constructor(
    @InjectRepository(Equipement)
    private readonly equipementRepository: Repository<Equipement>,
    @InjectRepository(Panne)
    private readonly panneRepository: Repository<Panne>,
  ) {}

  async importBuffer(buffer: Buffer, originalName: string, options?: ImportOptionsDto) {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const categoryName = this.resolveCategory(originalName, options?.category);
    const year = this.resolveYear(originalName, options?.year);

    let totalInserted = 0;
    let totalUpdated = 0;

    for (const sheetName of workbook.SheetNames.slice(0, MAX_SHEETS)) {
      const month = this.extractMonth(sheetName);
      if (!month) {
        continue;
      }

      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json<Array<string | number | null>>(sheet, {
        header: 1,
        defval: '',
      }).slice(0, MAX_ROWS_PER_SHEET);
      const normalizedRows = rows.map((row) => row.slice(0, MAX_COLUMNS_PER_ROW));

      if (normalizedRows.length < 3) {
        continue;
      }

      const headerRowIndex = this.findHeaderRowIndex(normalizedRows);
      if (headerRowIndex === -1) {
        this.logger.warn(`Ligne d'entete introuvable dans la feuille ${sheetName}.`);
        continue;
      }

      const headerMapping = this.resolveHeaderMapping(normalizedRows, headerRowIndex);
      if (!headerMapping.equipements.length) {
        this.logger.warn(`Aucun equipement detecte dans la feuille ${sheetName}.`);
        continue;
      }

      let lignesLues = 0;

      for (let rowIndex = headerMapping.dataStartIndex; rowIndex < normalizedRows.length; rowIndex += 1) {
        const row = normalizedRows[rowIndex] ?? [];
        const day = parseInt(String(row[0] ?? '').trim(), 10);

        if (Number.isNaN(day) || day < 1 || day > 31) {
          continue;
        }

        if (!isValidCalendarDate(year, month, day)) {
          this.logger.warn(
            `Date ignoree dans ${sheetName}: jour ${day} invalide pour ${String(month).padStart(2, '0')}/${year}.`,
          );
          continue;
        }

        lignesLues += 1;
        const dateString = buildIsoDate(year, month, day);

        for (const equipementInfo of headerMapping.equipements) {
          const rawPanne = String(row[equipementInfo.panneIndex] ?? '').trim();
          if (rawPanne === '') {
            continue;
          }

          const panneNumeric = Number(rawPanne);
          if (Number.isNaN(panneNumeric)) {
            continue;
          }

          if (panneNumeric !== 1) {
            continue;
          }

          const equipement = await this.getOrCreateEquipement(equipementInfo.name, categoryName);
          const rawHeure = row[equipementInfo.heureIndex];
          const heure = parseExcelTime(row[equipementInfo.heureIndex]);
          const commentaires =
            this.extractCellComment(sheet, rowIndex, equipementInfo.panneIndex) ?? IMPORT_STATUS.FAILURE;

          if (rawHeure !== null && rawHeure !== undefined && String(rawHeure).trim() !== '' && !heure) {
            this.logger.warn(
              `Heure non interpretable ignoree dans ${sheetName} | equipement=${equipementInfo.name} | jour=${day} | valeur=${String(rawHeure)}`,
            );
          }

          const recordQuery = this.panneRepository
            .createQueryBuilder('panne')
            .innerJoin('panne.equipement', 'equipement')
            .where('equipement.id = :equipementId', { equipementId: equipement.id })
            .andWhere('panne.dates = :dates', { dates: dateString });

          if (heure) {
            recordQuery.andWhere('panne.heure = :heure', { heure });
          } else {
            recordQuery.andWhere('panne.heure IS NULL');
          }

          let record = await recordQuery.getOne();

          if (!record) {
            record = this.panneRepository.create({
              equipement,
              dates: dateString,
              heure,
              commentaires,
            });
            totalInserted += 1;
          } else {
            record.heure = heure;
            record.commentaires = commentaires;
            totalUpdated += 1;
          }

          await this.panneRepository.save(record);
        }
      }

      this.logger.log(
        `[${sheetName}] equipements detectes: ${headerMapping.equipements.length} | lignes lues: ${lignesLues}`,
      );
    }

    await this.updateCounters(categoryName);

    return {
      status: 'success',
      insertedRecords: totalInserted,
      updatedRecords: totalUpdated,
      category: categoryName,
      message: `Importation de ${categoryName} terminee.`,
    };
  }

  private async updateCounters(category: string) {
    const equipements = await this.equipementRepository.find({
      where: { categorie: category },
    });

    for (const equipement of equipements) {
      const nombrePannes = await this.panneRepository.count({
        where: {
          equipement: { id: equipement.id },
        },
      });

      equipement.nombrePannes = nombrePannes;
      await this.equipementRepository.save(equipement);
    }
  }

  private async getOrCreateEquipement(nom: string, categorie: string) {
    let equipement = await this.equipementRepository.findOne({
      where: {
        nomEquipement: nom,
        categorie,
      },
    });

    if (!equipement) {
      equipement = this.equipementRepository.create({
        nomEquipement: nom,
        categorie,
        nombrePannes: 0,
      });
      equipement = await this.equipementRepository.save(equipement);
    }

    return equipement;
  }

  private parseEquipements(
    row0: Array<string | number | null>,
    row1: Array<string | number | null>,
  ): ParsedEquipement[] {
    const equipements: ParsedEquipement[] = [];

    for (let index = 1; index < row0.length; index += 1) {
      const rawName = String(row0[index] ?? '').trim();
      if (!rawName) {
        continue;
      }

      const normalizedName = normalizeText(rawName);
      if (['jour', 'heure', 'panne'].includes(normalizedName)) {
        continue;
      }

      const currentSubHeader = normalizeText(String(row1[index] ?? '').trim());
      const nextSubHeader = normalizeText(String(row1[index + 1] ?? '').trim());

      let heureIndex = -1;
      let panneIndex = -1;

      if (HEURE_HEADERS.includes(currentSubHeader) && PANNE_HEADERS.includes(nextSubHeader)) {
        heureIndex = index;
        panneIndex = index + 1;
      } else if (PANNE_HEADERS.includes(currentSubHeader)) {
        panneIndex = index;
        heureIndex = Math.max(1, index - 1);
      } else if (HEURE_HEADERS.includes(currentSubHeader) && PANNE_HEADERS.includes(currentSubHeader)) {
        heureIndex = index;
        panneIndex = index + 1;
      } else if (PANNE_HEADERS.includes(nextSubHeader)) {
        heureIndex = index;
        panneIndex = index + 1;
      }

      if (heureIndex === -1 || panneIndex === -1) {
        continue;
      }

      equipements.push({
        name: rawName.trim().toUpperCase().slice(0, MAX_EQUIPMENT_NAME_LENGTH),
        heureIndex,
        panneIndex,
      });
    }

    return equipements;
  }

  private resolveHeaderMapping(
    rows: Array<Array<string | number | null>>,
    headerRowIndex: number,
  ): HeaderMapping {
    const candidates: HeaderMapping[] = [];

    candidates.push({
      equipements: this.parseEquipements(rows[headerRowIndex] ?? [], rows[headerRowIndex + 1] ?? []),
      dataStartIndex: headerRowIndex + 2,
    });

    if (headerRowIndex > 0) {
      candidates.push({
        equipements: this.parseEquipements(rows[headerRowIndex - 1] ?? [], rows[headerRowIndex] ?? []),
        dataStartIndex: headerRowIndex + 1,
      });
    }

    return candidates.sort((left, right) => right.equipements.length - left.equipements.length)[0] ?? {
      equipements: [],
      dataStartIndex: headerRowIndex + 2,
    };
  }

  private findHeaderRowIndex(rows: Array<Array<string | number | null>>) {
    return rows.findIndex((row) =>
      row.some((cell) => normalizeText(String(cell ?? '')) === 'jour'),
    );
  }

  private extractCellComment(
    sheet: xlsx.WorkSheet,
    rowIndex: number,
    columnIndex: number,
  ) {
    const cellAddress = xlsx.utils.encode_cell({ r: rowIndex, c: columnIndex });
    const cell = sheet[cellAddress] as
      | (xlsx.CellObject & { c?: Array<{ t?: string }> })
      | undefined;

    if (!cell?.c?.length) {
      return null;
    }

    const comment = cell.c
      .map((entry) => String(entry.t ?? '').trim())
      .filter(Boolean)
      .join('\n')
      .trim();

    return comment.slice(0, MAX_COMMENT_LENGTH) || null;
  }

  private extractCategory(filename: string) {
    const normalizedFilename = filename.toUpperCase();

    if (normalizedFilename.includes('COM')) return 'COM';
    if (normalizedFilename.includes('MET')) return 'MET';
    if (normalizedFilename.includes('SURV') || normalizedFilename.includes('SUR')) return 'SURV';
    if (normalizedFilename.includes('RESEAU')) return 'RESEAU';

    return 'AUTRE';
  }

  private extractYear(filename: string) {
    const match = filename.match(/\d{4}/);
    return match ? parseInt(match[0], 10) : new Date().getFullYear();
  }

  private resolveCategory(filename: string, category?: string) {
    const cleaned = String(category ?? '').trim().toUpperCase();
    const resolved = cleaned || this.extractCategory(filename);

    if (!ALLOWED_CATEGORIES.has(resolved)) {
      throw new BadRequestException(
        'La categorie importee doit etre COM, SURV, MET, RESEAU ou AUTRE.',
      );
    }

    return resolved;
  }

  private resolveYear(filename: string, year?: string) {
    const parsed = parseInt(String(year ?? '').trim(), 10);
    const resolved = Number.isNaN(parsed) ? this.extractYear(filename) : parsed;
    const maxYear = new Date().getFullYear() + 1;

    if (resolved < 2000 || resolved > maxYear) {
      throw new BadRequestException(`L'annee importee doit etre comprise entre 2000 et ${maxYear}.`);
    }

    return resolved;
  }

  private extractMonth(sheetName: string) {
    const normalized = normalizeText(String(sheetName ?? ''));
    return FRENCH_MONTHS[normalized] ?? null;
  }
}
