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
    console.log(`[ClientesController] ========== autocomplete llamado ==========`);
    console.log(`[ClientesController] doc recibido: "${doc}"`);
    console.log(`[ClientesController] tipo de doc: ${typeof doc}`);
    
    if (!doc) {
      return { ok: false, error: 'Parámetro doc es requerido' };
    }

    const cleanDoc = (doc || '').replace(/[^0-9]/g, '');
    console.log(`[ClientesController] Documento limpio: ${cleanDoc}, longitud: ${cleanDoc.length}`);

    if (!cleanDoc || (cleanDoc.length !== 8 && cleanDoc.length !== 11)) {
      return { ok: false, error: 'Documento inválido (DNI 8 dígitos, RUC 11 dígitos)' };
    }

    try {
      if (cleanDoc.length === 8) {
        // DNI - RENIEC
        console.log(`[ClientesController] Consultando DNI: ${cleanDoc}`);
        try {
          const datos = await obtenerDatosPorDNI(cleanDoc);
          console.log(`[ClientesController] Datos recibidos de RENIEC:`, JSON.stringify(datos, null, 2));
          
          // Construir nombre completo de manera más robusta
          const partesNombre = [
            datos.apellidoPaterno,
            datos.apellidoMaterno,
            datos.nombres,
          ].filter(Boolean);
          const fullName = partesNombre.length > 0 
            ? partesNombre.join(' ').trim()
            : (datos.nombres || 'Cliente');
          
          console.log(`[ClientesController] Nombre completo construido: "${fullName}"`);
          console.log(`[ClientesController] Partes: apellidoPaterno="${datos.apellidoPaterno}", apellidoMaterno="${datos.apellidoMaterno}", nombres="${datos.nombres}"`);
          
          // Validar que el nombre no sea genérico
          if (!fullName || fullName === 'Cliente' || fullName.includes('Demo') || fullName.length < 3) {
            console.error(`[ClientesController] ❌ Nombre genérico o inválido recibido: "${fullName}"`);
            return { 
              ok: false, 
              error: 'No se pudieron obtener datos válidos del DNI. Verifique que el DNI sea correcto y que las credenciales de RENIEC estén configuradas.' 
            };
          }
          
          const result = {
            ok: true,
            type: 'DNI',
            name: fullName,
            document: cleanDoc,
            address: datos.direccion,
            civilStatus: datos.estadoCivil,
            raw: datos,
          };
          console.log(`[ClientesController] ✅ Respuesta DNI completa:`, JSON.stringify(result, null, 2));
          return result;
        } catch (error: any) {
          console.error(`[ClientesController] ❌ Error al consultar DNI ${cleanDoc}:`, error.message);
          return { 
            ok: false, 
            error: error.message || 'Error al consultar datos del DNI. Verifique que las credenciales de RENIEC estén configuradas correctamente.' 
          };
        }
      } else if (cleanDoc.length === 11) {
        // RUC - SUNAT
        console.log(`[ClientesController] Consultando RUC: ${cleanDoc}`);
        const datos = await obtenerDatosPorRUC(cleanDoc);
        console.log(`[ClientesController] Datos recibidos de SUNAT:`, datos);
        
        if (!datos) {
          return { ok: false, error: 'RUC inválido' };
        }

        const result = {
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
        console.log(`[ClientesController] Respuesta RUC:`, JSON.stringify(result, null, 2));
        return result;
      }
    } catch (error: any) {
      console.error('[ClientesController] Error consultando documento:', error);
      return { ok: false, error: error?.message || 'Error al consultar documento' };
    }

    return { ok: false, error: 'Formato de documento inválido' };
  }
}
