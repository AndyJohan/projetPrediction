import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Equipement } from './equipement.entity';

@Entity({ name: 'Pannes' })
export class Panne {
  @PrimaryGeneratedColumn({ name: 'ID' })
  id: number;

  @Column({ name: 'heure', type: 'time', nullable: true })
  heure: string | null;

  @Column({ name: 'dates', type: 'date', nullable: true })
  dates: string | null;

  @Column({ name: 'commentaires', type: 'text', nullable: true })
  commentaires: string | null;

  @ManyToOne(() => Equipement, (equipement) => equipement.pannes, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'equipement_id' })
  equipement: Equipement;
}
