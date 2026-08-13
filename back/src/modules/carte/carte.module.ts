import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Equipement } from '../../entities/equipement.entity';
import { Panne } from '../../entities/panne.entity';
import { CarteController } from './carte.controller';
import { CarteService } from './carte.service';

@Module({
  imports: [TypeOrmModule.forFeature([Equipement, Panne])],
  controllers: [CarteController],
  providers: [CarteService],
})
export class CarteModule {}
