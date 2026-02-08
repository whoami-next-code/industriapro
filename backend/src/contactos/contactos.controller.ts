import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  UseGuards,
  Req,
  BadRequestException,
  UseInterceptors,
  UploadedFiles,
  Delete,
} from '@nestjs/common';
import { ContactosService } from './contactos.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import type {
  CrearContactoDto,
  ActualizarEstadoDto,
  ResponderContactoDto,
  ReporteTecnicoDto,
} from './contactos.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

@Controller('api/contactos')
export class ContactosController {
  constructor(private readonly service: ContactosService) {}

  @Post()
  crear(@Body() body: CrearContactoDto) {
    return this.service.crear(body);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  listar() {
    return this.service.listar();
  }

  @Get('mios')
  @UseGuards(JwtAuthGuard)
  listarMios(@Req() req: any) {
    const email = req.user?.email;
    if (!email) {
      throw new BadRequestException('Usuario no válido');
    }
    return this.service.listarPorEmail(email);
  }

  @Put(':id/estado')
  @UseGuards(JwtAuthGuard)
  actualizarEstado(@Param('id') id: string, @Body() body: ActualizarEstadoDto) {
    return this.service.actualizarEstado(Number(id), body);
  }

  @Put(':id/respuesta')
  @UseGuards(JwtAuthGuard)
  responder(
    @Param('id') id: string,
    @Body() body: ResponderContactoDto,
    @Req() req: any,
  ) {
    const respondidoPor = req.user?.email || req.user?.userId || 'admin';
    return this.service.responder(Number(id), { ...body, respondidoPor });
  }

  @Get('asignados')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TECNICO', 'OPERARIO', 'ADMIN')
  listarAsignados(@Req() req: any) {
    const technicianId = Number(req.user?.userId);
    const technicianEmail = req.user?.email;
    if (!technicianId) {
      throw new BadRequestException('Usuario técnico no válido');
    }
    return this.service.listarAsignados(technicianId, technicianEmail);
  }

  @Put(':id/asignar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  asignarTecnico(@Param('id') id: string, @Body('technicianId') technicianId: number) {
    if (!technicianId) {
      throw new BadRequestException('Technician ID required');
    }
    return this.service.asignarTecnico(Number(id), Number(technicianId));
  }

  @Post(':id/reportes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TECNICO', 'OPERARIO', 'ADMIN')
  agregarReporte(
    @Param('id') id: string,
    @Body() body: ReporteTecnicoDto,
    @Req() req: any,
  ) {
    const technicianName = req.user?.fullName || req.user?.email;
    const payload =
      typeof body === 'string'
        ? (() => {
            try {
              return JSON.parse(body);
            } catch {
              return {};
            }
          })()
        : body ?? {};
    const message = (payload as any)?.message ?? (payload as any)?.mensaje ?? (payload as any)?.resumen;
    if (!message || String(message).trim().length === 0) {
      throw new BadRequestException('El reporte requiere un mensaje');
    }
    const normalizedBody: ReporteTecnicoDto = {
      message: String(message).trim(),
      found: (payload as any)?.found ?? (payload as any)?.encontrado ?? undefined,
      resolved: (payload as any)?.resolved ?? (payload as any)?.resultado ?? undefined,
      evidenceUrls: Array.isArray((payload as any)?.evidenceUrls)
        ? (payload as any)?.evidenceUrls
        : [],
    };
    return this.service.agregarReporte(Number(id), normalizedBody, technicianName);
  }

  @Delete(':id/reportes/:index')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  eliminarReporte(
    @Param('id') id: string,
    @Param('index') index: string,
  ) {
    const parsed = Number(index);
    if (!Number.isFinite(parsed)) {
      throw new BadRequestException('Índice de reporte inválido');
    }
    return this.service.eliminarReporte(Number(id), parsed);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  eliminar(@Param('id') id: string) {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      throw new BadRequestException('ID inválido');
    }
    return this.service.eliminar(numericId);
  }

  @Post('adjuntos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TECNICO', 'OPERARIO', 'ADMIN')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadAdjuntos(
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No se enviaron archivos');
    }
    return this.service.uploadAdjuntos(files);
  }

}
