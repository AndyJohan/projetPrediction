import { Module } from '@nestjs/common';
import { ParametreController } from './parametre.controller';
import { ParametreService } from './parametre.service';

@Module({
  controllers: [ParametreController],
  providers: [ParametreService],
})
export class ParametreModule {}
