import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, QueryFailedError } from 'typeorm';
import { User, UserRole, UserStatus } from './user.entity';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async create(data: {
    email: string;
    password?: string;
    role?: UserRole;
    fullName?: string;
    verified?: boolean;
    phone?: string;
    supabaseUid?: string;
    active?: boolean;
    mustChangePassword?: boolean;
    status?: User['status'];
  }) {
    const rawPassword = data.password ?? randomBytes(12).toString('hex');
    const passwordHash = await bcrypt.hash(rawPassword, 10);
    const entity = this.repo.create({
      email: data.email.toLowerCase().trim(),
      passwordHash,
      role: data.role ?? UserRole.CLIENTE,
      fullName: data.fullName,
      verified: data.verified ?? false,
      status: data.status ?? (data.verified ? UserStatus.VERIFIED : UserStatus.PENDING),
      phone: data.phone,
      supabaseUid: data.supabaseUid,
      active: data.active ?? true,
      mustChangePassword: data.mustChangePassword ?? false,
      tokenVersion: 0,
    });
    return this.repo.save(entity);
  }

  findBySupabaseUid(uid: string) {
    return this.repo.findOne({ where: { supabaseUid: uid } });
  }

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email: email.toLowerCase().trim() } });
  }

  findAll(params?: { role?: UserRole; verified?: boolean }) {
    const where: Partial<User> = {};
    if (params?.role) where.role = params.role;
    if (typeof params?.verified === 'boolean') where.verified = params.verified;
    return this.repo.find({ where, order: { createdAt: 'DESC' } });
  }

  findOne(id: number) {
    return this.repo.findOneBy({ id });
  }

  async update(id: number, data: Partial<User>) {
    const found = await this.repo.findOneBy({ id });
    if (!found) throw new NotFoundException('Usuario no encontrado');
    if (
      data.role &&
      found.role === UserRole.CLIENTE &&
      data.role !== UserRole.CLIENTE
    ) {
      throw new ForbiddenException(
        'Las cuentas de cliente no pueden cambiar de rol',
      );
    }
    if (data.status === UserStatus.VERIFIED) {
      data.verified = true;
    }
    if (data.status === UserStatus.PENDING) {
      data.verified = false;
    }
    if ((data as any).password) {
      (data as any).passwordHash = await bcrypt.hash(
        (data as any).password,
        10,
      );
      delete (data as any).password;
    }
    Object.assign(found, data);
    return this.repo.save(found);
  }

  async remove(id: number) {
    try {
      const res = await this.repo.delete(id);
      if (!res.affected) throw new NotFoundException('Usuario no encontrado');
      return { deleted: true };
    } catch (err: unknown) {
      if (err instanceof QueryFailedError) {
        const code = (err as any)?.code;
        // 23503: foreign_key_violation en Postgres
        if (code === '23503') {
          const existing = await this.repo.findOneBy({ id });
          if (!existing) {
            throw new NotFoundException('Usuario no encontrado');
          }
          await this.update(id, {
            active: false,
            status: UserStatus.SUSPENDED,
          });
          return { deleted: false, deactivated: true };
        }
      }
      throw err;
    }
  }

  async findUnverifiedOlderThan(days: number) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return this.repo.find({
      where: {
        verified: false,
        createdAt: LessThan(date),
      },
    });
  }

  async removeUnverifiedOlderThan(days: number) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    const result = await this.repo.delete({
      verified: false,
      createdAt: LessThan(date),
    });
    return result.affected || 0;
  }

  async fixEmails() {
    const users = await this.repo.find();
    let count = 0;
    for (const user of users) {
      const clean = user.email.toLowerCase().trim();
      if (user.email !== clean) {
        user.email = clean;
        await this.repo.save(user);
        count++;
      }
    }
    return { fixed: count };
  }
}
