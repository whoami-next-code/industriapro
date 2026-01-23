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
import { diskStorage } from 'multer';
import { join } from 'path';
import * as fs from 'fs';

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
  @Roles('TECNICO', 'ADMIN')
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
  @Roles('TECNICO', 'ADMIN')
  agregarReporte(
    @Param('id') id: string,
    @Body() body: ReporteTecnicoDto,
    @Req() req: any,
  ) {
    const technicianName = req.user?.fullName || req.user?.email;
    if (!body?.message) {
      throw new BadRequestException('El reporte requiere un mensaje');
    }
    return this.service.agregarReporte(Number(id), body, technicianName);
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
  @Roles('TECNICO', 'ADMIN')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dest = join(process.cwd(), 'public', 'uploads', 'contactos');
          try {
            fs.mkdirSync(dest, { recursive: true });
          } catch (e) {
            return cb(e as Error, dest);
          }
          cb(null, dest);
        },
        filename: (_req, file, cb) =>
          cb(
            null,
            `${Date.now()}-${Math.random().toString(16).slice(2)}-${file.originalname.replace(
              /\s+/g,
              '_',
            )}`,
          ),
      }),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  uploadAdjuntos(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    const forwardedProto =
      (req.headers['x-forwarded-proto'] as string) || req.protocol;
    const host = req.get('host');
    const baseUrl =
      process.env.PUBLIC_BASE_URL ||
      process.env.WEB_URL ||
      `${forwardedProto}://${host}`;
    const urls = (files || []).map(
      (f) => `${baseUrl}/uploads/contactos/${f.filename}`,
    );
    return { ok: true, urls };
  }

}
