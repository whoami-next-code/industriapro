import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  HttpException,
  HttpStatus,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { ComprobantesService } from './comprobantes.service';
import type { ComprobanteData } from './comprobantes.service';
import { MailService } from '../mail/mail.service';

@ApiTags('comprobantes')
@Controller('api/comprobantes')
export class ComprobantesController {
  constructor(
    private readonly comprobantesService: ComprobantesService,
    private readonly mailService: MailService,
  ) {}

  @Post('generar')
  @ApiOperation({ summary: 'Generar comprobante electrónico (voucher/boleta)' })
  @ApiResponse({
    status: 201,
    description: 'Comprobante generado exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  async generateComprobante(@Body() comprobanteData: ComprobanteData) {
    try {
      const comprobante =
        await this.comprobantesService.generateComprobante(comprobanteData);
      
      // Enviar comprobante por email si hay email del cliente
      if (comprobanteData.customerEmail && comprobante) {
        try {
          const documentType = comprobanteData.customerDni?.length === 11 ? 'FACTURA' : 'BOLETA';
          await this.mailService.sendComprobante({
            to: comprobanteData.customerEmail,
            customerName: comprobanteData.customerName,
            orderNumber: comprobanteData.orderNumber,
            comprobante,
            documentType,
          });
          console.log(`[ComprobantesController] Comprobante enviado por email a ${comprobanteData.customerEmail}`);
        } catch (emailErr) {
          console.error('[ComprobantesController] Error enviando comprobante por email:', emailErr);
          // No fallar la generación del comprobante si falla el envío de email
        }
      }
      
      return {
        ok: true,
        message: 'Comprobante generado exitosamente',
        data: comprobante,
      };
    } catch (error) {
      throw new HttpException(
        {
          ok: false,
          error: error.message || 'Error generando el comprobante',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('consultar/:id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Consultar comprobante por ID' })
  @ApiResponse({
    status: 200,
    description: 'Comprobante encontrado',
  })
  @ApiResponse({ status: 404, description: 'Comprobante no encontrado' })
  async getComprobante(@Param('id') id: string) {
    try {
      const comprobante = await this.comprobantesService.getComprobante(id);
      if (!comprobante) {
        throw new HttpException(
          {
            ok: false,
            error: 'Comprobante no encontrado',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        ok: true,
        comprobante,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          ok: false,
          error: error.message || 'Error consultando el comprobante',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('verificar')
  @ApiOperation({ summary: 'Verificar autenticidad de comprobante' })
  @ApiQuery({ name: 'id', description: 'ID del comprobante' })
  @ApiQuery({ name: 'hash', description: 'Hash de seguridad' })
  @ApiResponse({
    status: 200,
    description: 'Verificación completada',
  })
  async verifyComprobante(
    @Query('id') id: string,
    @Query('hash') hash: string,
  ) {
    try {
      const isValid = await this.comprobantesService.verifyComprobante(
        id,
        hash,
      );
      return {
        ok: true,
        valid: isValid,
        message: isValid ? 'Comprobante válido' : 'Comprobante inválido',
      };
    } catch (error) {
      throw new HttpException(
        {
          ok: false,
          error: error.message || 'Error verificando el comprobante',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id/download')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Descargar comprobante en formato PDF' })
  @ApiResponse({
    status: 200,
    description: 'PDF del comprobante',
    content: {
      'application/pdf': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Comprobante no encontrado' })
  async downloadComprobante(@Param('id') id: string, @Res() res: Response) {
    try {
      const comprobante = await this.comprobantesService.getComprobante(id);
      if (!comprobante) {
        throw new HttpException(
          {
            ok: false,
            error: 'Comprobante no encontrado',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // Generar PDF del comprobante
      // Por ahora, retornamos un JSON con los datos del comprobante
      // En producción, aquí se generaría un PDF real usando una librería como pdfkit o puppeteer
      const pdfData = await this.comprobantesService.generatePDF(comprobante);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="comprobante-${id}.pdf"`,
      );
      res.send(pdfData);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          ok: false,
          error: error.message || 'Error descargando el comprobante',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
