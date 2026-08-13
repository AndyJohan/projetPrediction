import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Equipement } from '../../entities/equipement.entity';
import { Panne } from '../../entities/panne.entity';

const ROUTE_DEFINITIONS = [
  {
    label: 'lien ATS/DS vers FMNM',
    equipmentName: 'LIEN ATS/DS VERS FMNM',
  },
  {
    label: 'lien ATS/DS vers FMMT',
    equipmentName: 'LIEN ATS/DS VERS FMMT',
  },
  {
    label: 'lien ATS/DS vers FMEE',
    equipmentName: 'LIEN ATS/DS VERS FMEE',
  },
  {
    label: 'lien ATS/DS vers FIMP',
    equipmentName: 'LIEN ATS/DS VERS FIMP',
  },
  {
    label: 'lien ATS/DS vers FMCZ',
    equipmentName: 'LIEN ATS/DS VERS FMCZ',
  },
  {
    label: 'lien ATS/DS vers FMCH',
    equipmentName: 'LIEN ATS/DS VERS FMCH',
  },
] as const;

@Injectable()
export class CarteService {
  constructor(
    @InjectRepository(Equipement)
    private readonly equipementRepository: Repository<Equipement>,
    @InjectRepository(Panne)
    private readonly panneRepository: Repository<Panne>,
  ) {}

  async getCarte() {
    const equipements = await this.equipementRepository.find({
      where: ROUTE_DEFINITIONS.map(({ equipmentName }) => ({ nomEquipement: equipmentName })),
      select: {
        id: true,
        nomEquipement: true,
        nombrePannes: true,
        categorie: true,
      },
    });

    const rawTotals = await this.panneRepository
      .createQueryBuilder('panne')
      .innerJoin('panne.equipement', 'equipement')
      .select('equipement.nomEquipement', 'nomEquipement')
      .addSelect('COUNT(panne.ID)', 'totalPannes')
      .where('equipement.nomEquipement IN (:...equipmentNames)', {
        equipmentNames: ROUTE_DEFINITIONS.map(({ equipmentName }) => equipmentName),
      })
      .groupBy('equipement.nomEquipement')
      .getRawMany<{ nomEquipement: string; totalPannes: string }>();

    const totalsByName = new Map(
      rawTotals.map((row) => [row.nomEquipement, Number(row.totalPannes) || 0]),
    );
    const equipmentByName = new Map(
      equipements.map((equipement) => [equipement.nomEquipement, equipement]),
    );

    return {
      source: 'database',
      routes: ROUTE_DEFINITIONS.map(({ label, equipmentName }) => {
        // Map lookup keeps route assembly O(1) per item instead of scanning equipments each time.
        const equipement = equipmentByName.get(equipmentName);

        return {
          label,
          nomEquipement: equipmentName,
          totalPannes: totalsByName.get(equipmentName) ?? equipement?.nombrePannes ?? 0,
          categorie: equipement?.categorie ?? null,
        };
      }),
    };
  }
}
