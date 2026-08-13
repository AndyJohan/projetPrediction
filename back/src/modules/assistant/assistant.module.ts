import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Panne } from '../../entities/panne.entity';
import { AssistantContextService } from './assistant-context.service';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

@Module({
  imports: [TypeOrmModule.forFeature([Panne])],
  controllers: [AssistantController],
  providers: [AssistantService, AssistantContextService],
})
export class AssistantModule {}
