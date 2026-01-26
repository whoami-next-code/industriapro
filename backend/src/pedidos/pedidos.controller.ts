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
  Query,
  HttpException,
  HttpStatus,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join } from 'path';
import * as fs from 'fs';
import { PedidosService } from './pedidos.service';
import { EventsService } from '../realtime/events.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { MailService } from '../mail/mail.service';
import { ComprobantesService } from '../comprobantes/comprobantes.service';

@ApiTags('pedidos')
@Controller('api/pedidos')
export class PedidosController {
  constructor(
    private readonly service: PedidosService,
    private readonly events: EventsService,
    private readonly mail: MailService,
    private readonly comprobantes: ComprobantesService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() req: any, @Body() body: any) {
    // Asegurar que el pedido se asocie al usuario autenticado
    const userId = req.user?.userId;
    const payload = { ...body, userId };
    return this.service.create(payload).then((order) => {
      this.events.pedidosUpdated({ id: order.id, action: 'create' });
      // Enviar correo de orden registrada si hay email del cliente
      if (order.customerEmail) {
        let items: Array<{ name: string; qty: number; price: number }> = [];
        try {
          const parsed = JSON.parse(order.items || '[]');
          if (Array.isArray(parsed)) {
            items = parsed.map((it: any) => ({
              name: String(it?.name ?? it?.producto ?? 'Producto'),
              qty: Number(it?.qty ?? it?.cantidad ?? 1),
              price: Number(it?.price ?? it?.precio ?? 0),
            }));
          }
        } catch {}
        const trackingNumber = `TRK-${order.orderNumber}`;
        this.mail.sendOrderRegistered({
          to: order.customerEmail,
          fullName: order.customerName,
          orderNumber: order.orderNumber,
          trackingNumber,
          items,
          total: Number(order.total),
        });
      }
      return order;
    });
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  // Pedidos del usuario autenticado
  @Get('mios')
  @UseGuards(JwtAuthGuard)
  findMine(@Req() req: any) {
    const userId = req.user?.userId;
    return this.service.findByUserId(Number(userId));
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.service.findOne(Number(id));
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'VENDEDOR')
  update(@Param('id') id: string, @Body() body: any) {
    return this.service.update(Number(id), body).then((order) => {
      this.events.pedidosUpdated({ id: Number(id), action: 'update' });
      return order;
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.service.remove(Number(id)).then(() => {
      this.events.pedidosUpdated({ id: Number(id), action: 'delete' });
      return { ok: true };
    });
  }

  // Nuevos endpoints para el sistema de ventas
  @Post('contra-entrega')
  @ApiOperation({ summary: 'Crear pedido con pago contra entrega' })
  @ApiResponse({
    status: 201,
    description: 'Pedido creado exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async createCashOnDeliveryOrder(@Body() createOrderDto: any) {
    try {
      const order =
        await this.service.createCashOnDeliveryOrder(createOrderDto);
      return {
        ok: true,
        message: 'Pedido creado exitosamente',
        orderId: order.id,
        orderNumber: order.orderNumber,
        order,
      };
    } catch (error) {
      throw new HttpException(
        {
          ok: false,
          error: error.message || 'Error creando el pedido',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('pago-ficticio')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Registrar pago ficticio y generar comprobante/factura' })
  async createFakePayment(@Req() req: any, @Body() body: any) {
    const userId = req.user?.userId;
    const items = Array.isArray(body?.items) ? body.items : [];
    const customerData = body?.customerData || {};
    const rawDocument = String(customerData?.document ?? '').trim();
    const documentType =
      customerData?.documentType === 'ruc' || rawDocument.length === 11
        ? 'RUC'
        : 'DNI';
    const customerName = String(customerData?.name ?? '').trim();
    const customerPhone = String(customerData?.phone ?? '').trim();
    const customerEmail = String(customerData?.email ?? '').trim() || undefined;
    const shippingAddress = String(customerData?.address ?? body?.shippingAddress ?? '').trim();

    if (!items.length) {
      throw new HttpException({ ok: false, error: 'Items inválidos' }, HttpStatus.BAD_REQUEST);
    }
    if (!rawDocument || !customerName || !shippingAddress) {
      throw new HttpException({ ok: false, error: 'Datos de cliente incompletos' }, HttpStatus.BAD_REQUEST);
    }

    const subtotal = items.reduce(
      (sum: number, it: any) =>
        sum + Number(it?.price ?? it?.precioUnitario ?? 0) * Number(it?.quantity ?? it?.cantidad ?? 0),
      0,
    );
    const shipping = 0;
    const total = Number(body?.total ?? subtotal + shipping);
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
    const paymentId = `FAKE-${Date.now()}`;

    const comprobanteItems = items.map((it: any) => ({
      productId: Number(it?.productId ?? 0),
      name: String(it?.name ?? it?.nombre ?? 'Producto'),
      price: Number(it?.price ?? it?.precioUnitario ?? 0),
      quantity: Number(it?.quantity ?? it?.cantidad ?? 0),
      total: Number(it?.price ?? it?.precioUnitario ?? 0) * Number(it?.quantity ?? it?.cantidad ?? 0),
    }));

    const baseDocPayload = {
      orderNumber,
      customerName,
      customerDni: rawDocument,
      customerEmail,
      customerPhone,
      shippingAddress,
      items: comprobanteItems,
      subtotal,
      shipping,
      total,
      paymentMethod: 'CARD' as const,
      paymentStatus: 'COMPLETED',
      orderDate: new Date(),
      notes: 'Pago ficticio',
    };

    const boletaResult = documentType === 'DNI'
      ? await this.comprobantes.generateBoletaNubefact(baseDocPayload)
      : null;
    const facturaResult = documentType === 'RUC'
      ? await this.comprobantes.generateFacturaNubefact(baseDocPayload)
      : null;

    const comprobante = documentType === 'DNI'
      ? (boletaResult?.ok
          ? this.comprobantes.normalizeNubefactForEmail(
              boletaResult.data,
              baseDocPayload,
              'BOLETA',
            )
          : await this.comprobantes.generateComprobante(baseDocPayload))
      : null;

    const factura = documentType === 'RUC'
      ? (facturaResult?.ok
          ? this.comprobantes.normalizeNubefactForEmail(
              facturaResult.data,
              baseDocPayload,
              'FACTURA',
            )
          : { ok: false, error: facturaResult?.error ?? 'Factura no generada' })
      : null;

    const notes = JSON.stringify({
      comprobante,
      factura,
      nubefact: {
        boleta: boletaResult,
        factura: facturaResult,
      },
      payment: { method: 'FAKE', id: paymentId },
    });

    const order = await this.service.create({
      orderNumber,
      userId,
      customerName,
      customerDni: rawDocument,
      customerEmail,
      customerPhone,
      shippingAddress,
      items: JSON.stringify(items),
      subtotal,
      shipping,
      total,
      paymentMethod: 'CARD',
      paymentStatus: 'COMPLETED',
      orderStatus: 'CONFIRMED',
      stripePaymentId: paymentId,
      status: 'PAGADO',
      notes,
    });

    this.events.pedidosUpdated({ id: order.id, action: 'create' });

    // Enviar comprobante por email si hay email del cliente
    if (customerEmail && (comprobante || factura)) {
      try {
        await this.mail.sendComprobante({
          to: customerEmail,
          customerName,
          orderNumber,
          comprobante: factura || comprobante,
          documentType: documentType === 'RUC' ? 'FACTURA' : 'BOLETA',
        });
        console.log(`[PedidosController] Comprobante enviado por email a ${customerEmail}`);
      } catch (emailErr) {
        console.error('[PedidosController] Error enviando comprobante por email:', emailErr);
        // No fallar el pedido si falla el envío de email
      }
    }

    return {
      ok: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      comprobante,
      factura,
      paymentId,
    };
  }

  @Get('by-payment')
  @ApiOperation({ summary: 'Obtener pedido por ID de pago de Stripe' })
  @ApiQuery({ name: 'paymentId', description: 'ID del pago de Stripe' })
  @ApiResponse({
    status: 200,
    description: 'Pedido encontrado',
  })
  @ApiResponse({ status: 404, description: 'Pedido no encontrado' })
  async getOrderByPayment(@Query('paymentId') paymentId: string) {
    try {
      const order = await this.service.getOrderByPaymentId(paymentId);
      if (!order) {
        throw new HttpException(
          {
            ok: false,
            error: 'Pedido no encontrado',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        ok: true,
        order,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          ok: false,
          error: error.message || 'Error obteniendo el pedido',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('by-order-id')
  @ApiOperation({ summary: 'Obtener pedido por ID de pedido' })
  @ApiQuery({ name: 'orderId', description: 'ID del pedido' })
  @ApiResponse({
    status: 200,
    description: 'Pedido encontrado',
  })
  @ApiResponse({ status: 404, description: 'Pedido no encontrado' })
  async getOrderById(@Query('orderId') orderId: string) {
    try {
      const order = await this.service.getOrderById(orderId);
      if (!order) {
        throw new HttpException(
          {
            ok: false,
            error: 'Pedido no encontrado',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        ok: true,
        order,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          ok: false,
          error: error.message || 'Error obteniendo el pedido',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/avances')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Agregar avance a un pedido' })
  @ApiResponse({ status: 201, description: 'Avance agregado exitosamente' })
  @ApiResponse({ status: 404, description: 'Pedido no encontrado' })
  async addAvance(@Param('id') id: string, @Body() body: any) {
    try {
      const order = await this.service.findOne(Number(id));
      if (!order) {
        throw new HttpException(
          { ok: false, error: 'Pedido no encontrado' },
          HttpStatus.NOT_FOUND,
        );
      }

      // Almacenar el avance en las notas del pedido (estructura simple)
      const avance = {
        fecha: new Date().toISOString(),
        mensaje: body.message || body.mensaje || '',
        estado: body.status || body.estado || order.orderStatus,
        tecnico: body.technicianName || body.tecnico || null,
      };

      // Agregar al campo notes como JSON si existe, o crear nuevo
      let avances = [];
      try {
        const existingNotes = order.notes ? JSON.parse(order.notes) : {};
        avances = existingNotes.avances || [];
      } catch {
        avances = [];
      }

      avances.push(avance);
      const updatedNotes = JSON.stringify({ ...(order.notes ? JSON.parse(order.notes) : {}), avances });

      await this.service.update(Number(id), { notes: updatedNotes });
      this.events.pedidosUpdated({ id: Number(id), action: 'update' });

      return {
        ok: true,
        message: 'Avance agregado exitosamente',
        avance,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          ok: false,
          error: error.message || 'Error agregando el avance',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/evidencias')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const uploadsDir = join(process.cwd(), 'public', 'uploads', 'pedidos', 'evidencias');
          fs.mkdirSync(uploadsDir, { recursive: true });
          cb(null, uploadsDir);
        },
        filename: (_req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
          const sanitizedName = file.originalname.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
          cb(null, `evidencia_${uniqueSuffix}_${sanitizedName}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB por archivo
    }),
  )
  @ApiOperation({ summary: 'Agregar evidencias (archivos) a un pedido' })
  @ApiResponse({ status: 201, description: 'Evidencias agregadas exitosamente' })
  @ApiResponse({ status: 404, description: 'Pedido no encontrado' })
  async addEvidencias(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: any,
  ) {
    try {
      const order = await this.service.findOne(Number(id));
      if (!order) {
        throw new HttpException(
          { ok: false, error: 'Pedido no encontrado' },
          HttpStatus.NOT_FOUND,
        );
      }

      // Obtener tipos y comentarios del body (vienen como campos del form-data)
      const tipos = req.body?.tipos ? 
        (typeof req.body.tipos === 'string' ? req.body.tipos.split(',') : req.body.tipos) : [];
      const comentarios = req.body?.comentarios ? 
        (typeof req.body.comentarios === 'string' ? req.body.comentarios.split('|||') : req.body.comentarios) : [];

      // Generar URLs de los archivos subidos
      const baseUrl = process.env.PUBLIC_BASE_URL || 
                      process.env.WEB_URL || 
                      'http://localhost:3001';
      const archivosUrls = (files || []).map(
        (f) => `${baseUrl}/uploads/pedidos/evidencias/${f.filename}`,
      );

      // Crear objeto de evidencias
      const evidencias = {
        fecha: new Date().toISOString(),
        archivos: archivosUrls,
        tipos: tipos,
        comentarios: comentarios,
      };

      // Agregar al campo notes
      let evidenciasList = [];
      try {
        const existingNotes = order.notes ? JSON.parse(order.notes) : {};
        evidenciasList = existingNotes.evidencias || [];
      } catch {
        evidenciasList = [];
      }

      evidenciasList.push(evidencias);
      const updatedNotes = JSON.stringify({
        ...(order.notes ? JSON.parse(order.notes) : {}),
        evidencias: evidenciasList,
      });

      await this.service.update(Number(id), { notes: updatedNotes });
      this.events.pedidosUpdated({ id: Number(id), action: 'update' });

      return {
        ok: true,
        message: 'Evidencias agregadas exitosamente',
        evidencias,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          ok: false,
          error: error.message || 'Error agregando las evidencias',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
