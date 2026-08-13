import { Controller, Get } from '@nestjs/common';
import { PredictionService } from './prediction.service';

@Controller('prediction')
export class PredictionController {
  constructor(private readonly predictionService: PredictionService) {}

  @Get()
  getPredictions() {
    return this.predictionService.getPredictions();
  }
}
