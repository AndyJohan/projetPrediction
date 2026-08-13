import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Panne } from './panne.entity';

@Entity({ name: 'equipements' })
@Index(['nomEquipement', 'categorie'], { unique: true })
export class Equipement {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'nomEquipement', type: 'varchar', length: 255 })
  nomEquipement: string;

  @Column({ name: 'nombrePannes', type: 'int', default: 0 })
  nombrePannes: number;

  @Column({ name: 'categorie', type: 'varchar', length: 100, nullable: true })
  categorie: string | null;

  @OneToMany(() => Panne, (panne) => panne.equipement)
  pannes: Panne[];
}
