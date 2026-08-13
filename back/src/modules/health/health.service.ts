import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getStatus() {
    return {
      status: 'ok',
      service: 'prediction-api',
      timestamp: new Date().toISOString(),
    };
  }
}
