import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseGuards,
  Req,
  BadRequestException,
  NotFoundException,
  UploadedFiles,
  UseInterceptors,
  Query,
} from '@nestjs/common';
import { CotizacionesService } from './cotizaciones.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join } from 'path';
import * as fs from 'fs';
import { MailService } from '../mail/mail.service';
import { WhatsappService } from './whatsapp.service';
import { CreateCotizacionDto } from './dto/create-cotizacion.dto';
import { AddProgressDto } from './dto/add-progress.dto';
import { EventsService } from '../realtime/events.service';

@Controller('api/cotizaciones')
export class CotizacionesController {
  constructor(
    private readonly service: CotizacionesService,
    private readonly mail: MailService,
    private readonly whatsapp: WhatsappService,
    private readonly events: EventsService,
  ) {}

  private parseId(id: string): number {
    const value = Number(id);
    if (!Number.isFinite(value)) {
      throw new BadRequestException('ID de cotización inválido');
    }
    return value;
  }

  private parseUpdateIndex(index: string): number {
    const value = Number(index);
    if (!Number.isFinite(value)) {
      throw new BadRequestException('Índice de avance inválido');
    }
    return value;
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'VENDEDOR', 'CLIENTE')
  async create(@Req() req: any, @Body() body: CreateCotizacionDto) {
    // Seguridad: forzar que la cotización se asocie al usuario autenticado
    const email = req.user?.email;
    if (!email) throw new BadRequestException('Usuario no válido');
    const safeBody = {
      ...body,
      customerEmail: email,
      status: 'PENDIENTE',
      need: body?.need ?? body?.descripcion ?? undefined,
      estimatedDate:
        body?.estimatedDate ??
        body?.delivery ??
        body?.estimatedDeliveryDate ??
        undefined,
      estimatedDeliveryDate:
        body?.estimatedDeliveryDate ??
        body?.estimatedDate ??
        body?.delivery ??
        undefined,
      budget:
        body?.budget !== undefined || body?.montoTotal !== undefined
          ? String(body?.budget ?? body?.montoTotal ?? '')
          : undefined,
      totalAmount:
        body?.montoTotal ??
        body?.totalAmount ??
        (typeof body?.budget === 'number' ? body.budget : undefined),
      preferredChannel: body?.preferredChannel ?? 'WHATSAPP',
      customerCompany: body?.company ?? body?.customerCompany ?? undefined,
      customerDocument: body?.customerDocument ?? body?.documento ?? undefined,
      customerAddress: body?.customerAddress ?? body?.direccion ?? undefined,
      technicianName: body?.technicianName ?? undefined,
      technicianPhone: body?.technicianPhone ?? undefined,
      technicianEmail: body?.technicianEmail ?? undefined,
      installationTechnician: body?.installationTechnician ?? undefined,
      items: Array.isArray(body.items) ? body.items : [],
      progressUpdates: [],
    };
    const created = await this.service.create(safeBody);

    // Notificar por correo al equipo de ventas/soporte
    const notifyTo =
      process.env.QUOTES_NOTIFY_EMAIL ||
      process.env.ADMIN_ALERT_EMAIL ||
      process.env.SUPPORT_EMAIL;
    if (notifyTo) {
      try {
        const attachmentList =
          (created.attachmentUrls || [])
            .map((u) => `<li><a href="${u}">${u}</a></li>`)
            .join('') || '<li>Sin adjuntos</li>';
        const itemsList =
          (created.items || [])
            .map((it) => `<li>Producto #${it.productId} x ${it.quantity}</li>`)
            .join('') || '<li>Sin items</li>';

        await this.mail.sendQuoteNotification({
          to: notifyTo,
          customerName: created.customerName,
          customerEmail: created.customerEmail,
          productName: created.productName,
          status: created.status,
          notes: created.notes,
          attachmentHtml: `<ul>${attachmentList}</ul>`,
          itemsHtml: `<ul>${itemsList}</ul>`,
        });
      } catch (mailErr: any) {
        // No fallar la creación si falla el correo
      }
    }

    this.events.cotizacionesUpdated({ id: created.id, action: 'create' });
    return created;
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'VENDEDOR', 'TECNICO')
  findAll(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('q') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('email') email?: string,
    @Query('technician') technician?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/638fba18-ebc9-4dbf-9020-8d680af003ce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H3',
        location: 'cotizaciones.controller.ts:findAll',
        message: 'findAll invoked',
        data: {
          userRole: (arguments as any)?.[0]?.user?.role,
          params: { status, search, from, to, email, technician, page, limit },
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    const parsedPage = Number(page);
    const parsedLimit = Number(limit);
    const role = req?.user?.role;
    const isTechnician = role === 'TECNICO';
    return this.service.findAll({
      status: status || undefined,
      search: search || undefined,
      from: from || undefined,
      to: to || undefined,
      customerEmail: email || undefined,
      technician: technician || undefined,
      technicianId: isTechnician ? req?.user?.userId : undefined,
      technicianEmail: isTechnician ? req?.user?.email : undefined,
    }, {
      page: Number.isFinite(parsedPage) ? parsedPage : undefined,
      limit: Number.isFinite(parsedLimit) ? parsedLimit : undefined,
    });
  }

  @Get('workload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPERADMIN', 'VENDEDOR')
  getWorkload() {
    return this.service.getTechnicianWorkload();
  }

  @Get('mias')
  @UseGuards(JwtAuthGuard)
  findMine(@Req() req: any) {
    // #region agent log
    const fs = require('fs');
    const logPath =
      'c:\\Users\\USUARIO\\Desktop\\insdustriaSP\\.cursor\\debug.log';
    try {
      fs.appendFileSync(
        logPath,
        JSON.stringify({
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'H1',
          location: 'cotizaciones.controller.ts:findMine',
          message: 'findMine endpoint called',
          data: {
            hasUser: !!req.user,
            userEmail: req.user?.email,
            userId: req.user?.userId,
          },
          timestamp: Date.now(),
        }) + '\n',
      );
    } catch {}
    // #endregion
    const email = req.user?.email;
    if (!email) throw new BadRequestException('Usuario no válido');
    const result = this.service.findByEmail(email);
    // #region agent log
    try {
      fs.appendFileSync(
        logPath,
        JSON.stringify({
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'H1',
          location: 'cotizaciones.controller.ts:findMine',
          message: 'findMine result',
          data: {
            email,
            resultCount: Array.isArray(result) ? result.length : 'not-array',
          },
          timestamp: Date.now(),
        }) + '\n',
      );
    } catch {}
    // #endregion
    return result;
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @Req() req: any) {
    const isClient = req.user?.role === 'CLIENTE';
    const numericId = this.parseId(id);
    return this.service.findOne(numericId, isClient);
  }

  @Get(':id/reporte')
  @UseGuards(JwtAuthGuard)
  async report(@Param('id') id: string) {
    const numericId = this.parseId(id);
    return this.service.buildReport(numericId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'VENDEDOR')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const numericId = this.parseId(id);
    const userId = req.user?.userId || req.user?.sub;
    const updated = await this.service.update(numericId, body, userId);
    this.events.cotizacionesUpdated({ id: numericId, action: 'update' });
    return updated;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async remove(@Param('id') id: string) {
    const numericId = this.parseId(id);
    const res = await this.service.remove(numericId);
    this.events.cotizacionesUpdated({ id: numericId, action: 'delete' });
    return res;
  }

  @Post('adjuntos')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'VENDEDOR', 'CLIENTE', 'TECNICO')
  @UseInterceptors(
    FilesInterceptor('files', 5, {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dest = join(process.cwd(), 'public', 'uploads', 'cotizaciones');
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
  upload(
    @UploadedFiles()
    files: Express.Multer.File[],
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
      (f) => `${baseUrl}/uploads/cotizaciones/${f.filename}`,
    );
    return { ok: true, urls };
  }

  @Post(':id/avances')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'VENDEDOR', 'TECNICO')
  async addProgress(@Param('id') id: string, @Body() body: AddProgressDto, @Req() req: any) {
    const numericId = this.parseId(id);
    const userId = req.user?.userId || req.user?.sub;
    try {
      const updated = await this.service.addProgress(
        numericId,
        {
          message: body.message,
          status: body.status,
          estimatedDate: body.estimatedDate,
          attachmentUrls: body.attachmentUrls || [],
          materials: body.materials,
          author: body.author || 'Sistema',
          channel: body.channel || 'WHATSAPP',
          progressPercent: body.progressPercent,
          technician: body.technician,
        },
        {
          technicianName: body.technicianName,
          technicianPhone: body.technicianPhone,
          technicianEmail: body.technicianEmail,
          installationTechnician:
            body.installationTechnician || body.technicianName,
          clientMessage: body.clientMessage,
        },
        userId
      );

      // Intentar notificar por WhatsApp si hay teléfono
      try {
        if (updated.customerPhone) {
          await this.whatsapp.sendUpdate({
            to: updated.customerPhone,
            message: body.message,
            quoteId: updated.id,
            status: body.status,
            attachmentUrls: body.attachmentUrls,
          });
        }
      } catch (err) {
        // No interrumpir el flujo por fallas de notificación
        console.error('Error notificando por WhatsApp', err?.message || err);
      }

      this.events.cotizacionesUpdated({ id: numericId, action: 'update' });
      return updated;
    } catch (error) {
      console.error('Error en addProgress:', error);
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException(
        `Error al registrar avance: ${error.message || error}`,
      );
    }
  }

  @Put(':id/assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async assignTechnician(
    @Param('id') id: string,
    @Body('technicianId') technicianId: number,
  ) {
    const numericId = this.parseId(id);
    if (!technicianId) throw new BadRequestException('Technician ID required');
    const updated = await this.service.assignTechnician(numericId, technicianId);
    this.events.cotizacionesUpdated({ id: numericId, action: 'update' });
    return updated;
  }

  @Put(':id/approve/:updateIndex')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async approveStage(
    @Param('id') id: string,
    @Param('updateIndex') updateIndex: string,
    @Req() req: any,
  ) {
    const numericId = this.parseId(id);
    const index = this.parseUpdateIndex(updateIndex);
    const userId = req.user?.userId || req.user?.sub;
    const updated = await this.service.approveStage(numericId, index, userId);
    return updated;
  }

  @Put(':id/reject/:updateIndex')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async rejectStage(
    @Param('id') id: string,
    @Param('updateIndex') updateIndex: string,
    @Body('reason') reason: string,
    @Req() req: any,
  ) {
    const numericId = this.parseId(id);
    const index = this.parseUpdateIndex(updateIndex);
    if (!reason) throw new BadRequestException('Rejection reason required');
    const userId = req.user?.userId || req.user?.sub;
    const updated = await this.service.rejectStage(numericId, index, userId, reason);
    return updated;
  }

  @Get(':id/images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'VENDEDOR', 'CLIENTE')
  async getImages(
    @Param('id') id: string,
    @Req() req: any,
    @Query('approved') approved?: string,
  ) {
    const numericId = this.parseId(id);
    const isClient = req.user.role === 'CLIENTE';
    const shouldFilter = isClient || approved === 'true';
    return this.service.getImages(numericId, shouldFilter);
  }

  @Put('images/:imageId/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'VENDEDOR')
  async approveImage(@Param('imageId') imageId: string) {
    return this.service.approveImage(imageId);
  }

  @Put('images/:imageId/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'VENDEDOR')
  async rejectImage(@Param('imageId') imageId: string) {
    return this.service.rejectImage(imageId);
  }

  @Post(':id/images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'VENDEDOR', 'CLIENTE')
  @UseInterceptors(FilesInterceptor('file', 1)) // Expect 'file' field
  async uploadImage(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    const numericId = this.parseId(id);
    if (!files || files.length === 0) {
      throw new BadRequestException('No file uploaded');
    }
    return this.service.uploadImage(numericId, files[0], req.user);
  }
}
