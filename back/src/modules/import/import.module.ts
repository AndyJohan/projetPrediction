import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { Equipement } from '../../entities/equipement.entity';
import { Panne } from '../../entities/panne.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Equipement, Panne])],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
