import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { CotizacionesService } from '../cotizaciones/cotizaciones.service';

@ApiTags('trabajos')
@Controller('api/trabajos')
@UseGuards(SupabaseAuthGuard)
export class TrabajosController {
  constructor(private readonly cotizaciones: CotizacionesService) {}

  @Get('asignados')
  asignados(@Req() req: any) {
    const userId = req.user?.userId;
    const email = req.user?.email;
    // Si no hay usuario autenticado, devolver lista vacía (solo para desarrollo)
    if (!userId) {
      return [];
    }
    return this.cotizaciones.findAll(
      {
        technicianId: Number(userId),
        technicianEmail: email,
      },
      { page: 1, limit: 100 },
    ).then((res: any) => (res?.data ? res.data : res));
  }
}
