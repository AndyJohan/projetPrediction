import { Injectable } from '@nestjs/common';

@Injectable()
export class PredictionService {
  getPredictions() {
    return {
      source: 'db-placeholder',
      horizon: '30 jours',
      risques: [],
      message: 'Expose les predictions issues du modele.',
    };
  }
}
