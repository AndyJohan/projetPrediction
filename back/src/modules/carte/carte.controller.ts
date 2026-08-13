import { Controller, Get } from '@nestjs/common';
import { CarteService } from './carte.service';

@Controller('carte')
export class CarteController {
  constructor(private readonly carteService: CarteService) {}

  @Get()
  getCarte() {
    return this.carteService.getCarte();
  }
}
