import { Controller, Get, Query } from '@nestjs/common';
import { SummaryQueryDto } from './dto/summary-query.dto';
import { HistoriqueService } from './historique.service';

@Controller('historique')
export class HistoriqueController {
  constructor(private readonly historiqueService: HistoriqueService) {}

  @Get('summary')
  getHistoriqueSummary(@Query('period') period?: string, @Query('category') category?: string) {
    const query: SummaryQueryDto = { period, category };
    return this.historiqueService.getSummary(query);
  }

  @Get()
  getHistoriqueDefault() {
    return this.historiqueService.getSummary({});
  }

  @Get('details')
  getHistoriqueDetails(@Query('period') period?: string, @Query('category') category?: string) {
    const query: SummaryQueryDto = { period, category };
    return this.historiqueService.getDetails(query);
  }
}
