import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { AnalizarContactoDto } from './dto/analizar-contacto.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('api/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('analizar-contacto')
  @UseGuards(JwtAuthGuard)
  async analizarContacto(@Body() dto: AnalizarContactoDto) {
    return this.aiService.analizarContacto(dto);
  }
}
