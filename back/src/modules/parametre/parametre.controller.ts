import { Body, Controller, Get, Put } from '@nestjs/common';
import { ParametreService } from './parametre.service';
import { UpdateParametresDto } from './dto/update-parametres.dto';

@Controller('parametre')
export class ParametreController {
  constructor(private readonly parametreService: ParametreService) {}

  @Get()
  getParametres() {
    return this.parametreService.getParametres();
  }

  @Put()
  updateParametres(@Body() body: UpdateParametresDto) {
    return this.parametreService.updateParametres(body);
  }
}
