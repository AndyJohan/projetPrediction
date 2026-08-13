import { Injectable } from '@nestjs/common';

@Injectable()
export class SupportService {
  getSupportInfo() {
    return {
      source: 'db-placeholder',
      contact: 'support@exemple.com',
      message: 'Expose les ressources de support.',
    };
  }
}
