import { Body, Controller, Get, Post } from '@nestjs/common';
import { AssistantService } from './assistant.service';
import { ChatDto } from './dto/chat.dto';

@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistantService: AssistantService) {}

  @Get()
  getAssistantSummary() {
    return this.assistantService.getAssistantSummary();
  }

  @Post('chat')
  chat(@Body() body: ChatDto) {
    return this.assistantService.chat(body);
  }
}
