import {
  Controller,
  Get,
  UseGuards,
  Req,
  UnauthorizedException,
  Put,
  Body,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { UpdateClientDto } from './dto/update-client.dto';
import { obtenerDatosPorDNI } from '../common/utils/reniec-api';
import { obtenerDatosPorRUC } from '../common/utils/ruc';

@Controller('api/clientes')
export class ClientesMeController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: any) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Usuario no autenticado');
    const user = await this.usersService.findOne(Number(userId));
    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    return {
      fullName: user.fullName ?? '',
      document: user.document ?? '',
      email: user.email,
      phone: user.phone ?? '',
      address: user.address ?? '',
    };
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@Req() req: any, @Body() body: UpdateClientDto) {
    const userId = req.user?.userId;
    if (!userId) throw new UnauthorizedException('Usuario no autenticado');
    const payload: Partial<UpdateClientDto> = {
      fullName: body.fullName,
      email: body.email?.toLowerCase(),
      document: body.document,
      phone: body.phone,
      address: body.address,
    };
    const updated = await this.usersService.update(Number(userId), payload);
    return {
      fullName: updated.fullName,
      email: updated.email,
      document: updated.document,
      phone: updated.phone,
      address: updated.address,
    };
  }

  @Get('autocomplete')
  async autocomplete(@Query('doc') doc: string) {
    if (!doc) {
      return { ok: false, error: 'Parámetro doc es requerido' };
    }

    const cleanDoc = (doc || '').replace(/[^0-9]/g, '');

    if (!cleanDoc || (cleanDoc.length !== 8 && cleanDoc.length !== 11)) {
      return { ok: false, error: 'Documento inválido (DNI 8 dígitos, RUC 11 dígitos)' };
    }

    try {
      if (cleanDoc.length === 8) {
        // DNI - RENIEC
        const datos = await obtenerDatosPorDNI(cleanDoc);
        const fullName = `${datos.apellidoPaterno} ${datos.apellidoMaterno} ${datos.nombres}`.trim();
        
        return {
          ok: true,
          type: 'DNI',
          name: fullName || 'Cliente',
          document: cleanDoc,
          address: datos.direccion,
          civilStatus: datos.estadoCivil,
          raw: datos,
        };
      } else if (cleanDoc.length === 11) {
        // RUC - SUNAT
        const datos = await obtenerDatosPorRUC(cleanDoc);
        
        if (!datos) {
          return { ok: false, error: 'RUC inválido' };
        }

        return {
          ok: true,
          type: 'RUC',
          businessName: datos.razonSocial || 'Empresa',
          document: datos.ruc,
          address: datos.direccion || '',
          status: datos.estado,
          condition: datos.condicion,
          activity: datos.actividadEconomica,
          legalRepresentatives: datos.representantesLegales || [],
          raw: datos,
        };
      }
    } catch (error: any) {
      console.error('Error consultando documento:', error);
      return { ok: false, error: error?.message || 'Error al consultar documento' };
    }

    return { ok: false, error: 'Formato de documento inválido' };
  }
}
