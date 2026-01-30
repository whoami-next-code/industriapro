import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contacto } from './contacto.entity';
import { User } from '../users/user.entity';
import { MailService } from '../mail/mail.service';
import { EventsService } from '../realtime/events.service';

export interface CrearContactoDto {
  nombre: string;
  email: string;
  telefono?: string;
  mensaje: string;
  productoId?: number;
}

export interface ActualizarEstadoDto {
  estado: 'nuevo' | 'en_proceso' | 'atendido' | 'cancelado';
}

export interface ResponderContactoDto {
  respuesta: string;
  respondidoPor?: string;
}

export interface ReporteTecnicoDto {
  message: string;
  found?: string;
  resolved?: string;
  evidenceUrls?: string[];
}

@Injectable()
export class ContactosService {
  private readonly publicBaseUrl =
    process.env.PUBLIC_BASE_URL ||
    process.env.BACKEND_URL ||
    process.env.WEB_URL ||
    process.env.NEXT_PUBLIC_WEB_URL ||
    '';

  private normalizePublicUrl(url: string): string {
    if (!url) return url;
    const base = this.publicBaseUrl;
    if (!base) return url;

    const isPrivateHost = (host: string) =>
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);

    if (url.startsWith('http')) {
      try {
        const parsed = new URL(url);
        const baseUrl = new URL(base);
        if (
          isPrivateHost(parsed.hostname) ||
          parsed.hostname === baseUrl.hostname ||
          parsed.protocol !== baseUrl.protocol
        ) {
          parsed.protocol = baseUrl.protocol;
          parsed.hostname = baseUrl.hostname;
          parsed.port = baseUrl.port;
        }
        return parsed.toString();
      } catch {
        return url;
      }
    }

    const clean = url.replace(/\\/g, '/').trim();
    return `${base}${clean.startsWith('/') ? '' : '/'}${clean}`;
  }
  constructor(
    @InjectRepository(Contacto)
    private readonly repo: Repository<Contacto>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly mail: MailService,
    @Optional() private readonly events?: EventsService,
  ) {}

  async crear(dto: CrearContactoDto): Promise<Contacto> {
    const entity = this.repo.create({ ...dto, estado: 'nuevo' });
    const saved = await this.repo.save(entity);
    this.events?.contactosUpdated({ id: saved.id, action: 'create' });
    return saved;
  }

  async listar(): Promise<Contacto[]> {
    return await this.repo.find({ order: { creadoEn: 'DESC' } });
  }

  async listarPorEmail(email: string): Promise<Contacto[]> {
    return await this.repo.find({
      where: { email },
      order: { creadoEn: 'DESC' },
    });
  }

  async listarAsignados(technicianId: number, technicianEmail?: string): Promise<Contacto[]> {
    const where = technicianEmail
      ? [{ technicianId }, { technicianEmail }]
      : [{ technicianId }];
    return this.repo.find({
      where,
      order: { creadoEn: 'DESC' },
    });
  }

  async actualizarEstado(
    id: number,
    dto: ActualizarEstadoDto,
  ): Promise<Contacto | null> {
    const contacto = await this.repo.findOne({ where: { id } });
    if (!contacto) return null;
    contacto.estado = dto.estado;
    const saved = await this.repo.save(contacto);
    this.events?.contactosUpdated({ id: saved.id, action: 'update' });
    return saved;
  }

  async responder(
    id: number,
    dto: ResponderContactoDto,
  ): Promise<Contacto | null> {
    const contacto = await this.repo.findOne({ where: { id } });
    if (!contacto) return null;
    contacto.respuesta = dto.respuesta;
    contacto.respondidoPor = dto.respondidoPor ?? contacto.respondidoPor;
    contacto.respondidoEn = new Date();
    if (contacto.estado === 'nuevo' || contacto.estado === 'en_proceso') {
      contacto.estado = 'atendido';
    }
    const saved = await this.repo.save(contacto);
    this.events?.contactosUpdated({ id: saved.id, action: 'update' });
    return saved;
  }

  async eliminar(id: number): Promise<{ ok: true }> {
    const contacto = await this.repo.findOne({ where: { id } });
    if (!contacto) throw new NotFoundException('Contacto no encontrado');
    await this.repo.remove(contacto);
    this.events?.contactosUpdated({ id, action: 'delete' });
    return { ok: true };
  }

  async asignarTecnico(id: number, technicianId: number): Promise<Contacto> {
    const contacto = await this.repo.findOne({ where: { id } });
    if (!contacto) throw new NotFoundException('Contacto no encontrado');
    const tech = await this.users.findOne({ where: { id: technicianId } });
    if (!tech) throw new NotFoundException('Técnico no encontrado');

    contacto.technicianId = tech.id;
    contacto.technicianName = tech.fullName || tech.email;
    contacto.technicianEmail = tech.email;
    contacto.technicianPhone = tech.phone;
    if (contacto.estado === 'nuevo') {
      contacto.estado = 'en_proceso';
    }
    const saved = await this.repo.save(contacto);
    this.events?.contactosUpdated({ id: saved.id, action: 'assign' });
    return saved;
  }

  async agregarReporte(id: number, dto: ReporteTecnicoDto, technicianName?: string) {
    const contacto = await this.repo.findOne({ where: { id } });
    if (!contacto) throw new NotFoundException('Contacto no encontrado');

    const reportes = Array.isArray(contacto.reportes) ? contacto.reportes : [];
    const normalizedEvidence = (dto.evidenceUrls ?? []).map((u) =>
      this.normalizePublicUrl(String(u)),
    );

    reportes.push({
      message: dto.message,
      found: dto.found,
      resolved: dto.resolved,
      evidenceUrls: normalizedEvidence,
      createdAt: new Date().toISOString(),
      technicianName: technicianName || contacto.technicianName,
    });
    contacto.reportes = reportes;
    contacto.estado = 'atendido';
    const saved = await this.repo.save(contacto);
    this.events?.contactosUpdated({ id: saved.id, action: 'report' });

    if (contacto.email) {
      await this.mail.sendContactoReporteTecnico({
        to: contacto.email,
        cliente: contacto.nombre,
        message: dto.message,
        found: dto.found,
        resolved: dto.resolved,
        evidenceUrls: dto.evidenceUrls ?? [],
        contactoId: contacto.id,
      }).catch(() => {});
    }

    return saved;
  }

  async eliminarReporte(id: number, index: number) {
    const contacto = await this.repo.findOne({ where: { id } });
    if (!contacto) throw new NotFoundException('Contacto no encontrado');
    const reportes = Array.isArray(contacto.reportes) ? contacto.reportes : [];
    if (index < 0 || index >= reportes.length) {
      throw new NotFoundException('Reporte no encontrado');
    }
    reportes.splice(index, 1);
    contacto.reportes = reportes;
    const saved = await this.repo.save(contacto);
    this.events?.contactosUpdated({ id: saved.id, action: 'report.delete' });
    return saved;
  }
}
