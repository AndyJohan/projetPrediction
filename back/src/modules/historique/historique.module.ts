import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HistoriqueController } from './historique.controller';
import { HistoriqueService } from './historique.service';
import { Panne } from '../../entities/panne.entity';
import { Equipement } from '../../entities/equipement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Panne, Equipement])],
  controllers: [HistoriqueController],
  providers: [HistoriqueService],
})
export class HistoriqueModule {}
