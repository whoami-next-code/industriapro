import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Product } from './product.entity';
import { EventsPublisher } from '../events/events.publisher';

@Injectable()
export class ProductosService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @Optional() private readonly eventsPublisher?: EventsPublisher,
  ) {}

  async create(data: Partial<Product>) {
    const entity = this.productRepo.create(data);
    const saved = await this.productRepo.save(entity);
    
    // Publicar evento en RabbitMQ
    if (this.eventsPublisher) {
      await this.eventsPublisher.productoCreated(saved).catch((error) => {
        console.error('Error publicando evento producto.creado:', error);
      });
    }
    
    return saved;
  }

  findAll(query?: { q?: string; category?: string }) {
    const where: any = {};
    if (query?.q) where.name = ILike(`%${query.q}%`);
    if (query?.category) where.category = query.category;
    return this.productRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  findOne(id: number) {
    return this.productRepo.findOneBy({ id });
  }

  async update(id: number, data: Partial<Product>) {
    const found = await this.productRepo.findOneBy({ id });
    if (!found) throw new NotFoundException('Producto no encontrado');
    Object.assign(found, data);
    const saved = await this.productRepo.save(found);
    
    // Publicar evento en RabbitMQ
    if (this.eventsPublisher) {
      await this.eventsPublisher.productoUpdated(saved).catch((error) => {
        console.error('Error publicando evento producto.actualizado:', error);
      });
    }
    
    return saved;
  }

  async remove(id: number) {
    const res = await this.productRepo.delete(id);
    if (!res.affected) throw new NotFoundException('Producto no encontrado');
    
    // Publicar evento en RabbitMQ
    if (this.eventsPublisher) {
      await this.eventsPublisher.productoDeleted(id).catch((error) => {
        console.error('Error publicando evento producto.eliminado:', error);
      });
    }
    
    return { deleted: true };
  }
}
