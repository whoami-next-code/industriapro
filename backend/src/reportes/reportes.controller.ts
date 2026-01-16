import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ReportesService } from './reportes.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('api/reportes')
@UseGuards(JwtAuthGuard)
@Roles('ADMIN')
export class ReportesController {
  constructor(private readonly service: ReportesService) {}

  @Get('muestreo')
  muestreo() {
    return this.service.generarMuestreo();
  }

  @Post('guardar')
  guardar(@Body() body: { nombre: string; datos: any }) {
    return this.service.guardar(body.nombre, body.datos);
  }

  @Get()
  listar() {
    return this.service.listar();
  }
}
