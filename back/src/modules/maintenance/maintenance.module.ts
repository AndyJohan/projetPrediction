import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Equipement } from '../../entities/equipement.entity';
import { Panne } from '../../entities/panne.entity';
import { Prediction } from '../../entities/prediction.entity';
import { InferenceService } from './inference.service';
import { MaintenanceController } from './maintenance.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Equipement, Panne, Prediction])],
  controllers: [MaintenanceController],
  providers: [InferenceService],
})
export class MaintenanceModule {}
