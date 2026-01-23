import { Injectable, NotFoundException, BadRequestException, Optional, forwardRef, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pedido } from './pedido.entity';
import { EventsPublisher } from '../events/events.publisher';
import { ProductosService } from '../productos/productos.service';

@Injectable()
export class PedidosService {
  constructor(
    @InjectRepository(Pedido)
    private readonly repo: Repository<Pedido>,
    @Optional() private readonly eventsPublisher?: EventsPublisher,
    @Inject(forwardRef(() => ProductosService))
    private readonly productosService?: ProductosService,
  ) {}

  async create(data: Partial<Pedido>) {
    // Generar orderNumber si no viene en los datos
    if (!data.orderNumber) {
      data.orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    }
    
    // Validar y restar stock antes de crear el pedido
    if (data.items) {
      try {
        const items = typeof data.items === 'string' ? JSON.parse(data.items) : data.items;
        if (Array.isArray(items)) {
          // Validar stock disponible para cada producto
          for (const item of items) {
            const productId = item.productId || item.id;
            const quantity = Number(item.quantity || item.qty || item.cantidad || 1);
            
            if (productId && this.productosService) {
              const product = await this.productosService.findOne(productId);
              if (!product) {
                throw new NotFoundException(`Producto con ID ${productId} no encontrado`);
              }
              
              if (product.stock < quantity) {
                throw new BadRequestException(
                  `Stock insuficiente para ${product.name}. Disponible: ${product.stock}, Solicitado: ${quantity}`
                );
              }
            }
          }
          
          // Restar stock de cada producto
          for (const item of items) {
            const productId = item.productId || item.id;
            const quantity = Number(item.quantity || item.qty || item.cantidad || 1);
            
            if (productId && this.productosService) {
              const product = await this.productosService.findOne(productId);
              if (product) {
                const oldStock = product.stock;
                const newStock = Math.max(0, oldStock - quantity);
                await this.productosService.update(productId, { stock: newStock });
                console.log(`[PedidosService] Stock actualizado: ${product.name} - ${oldStock} → ${newStock} (restado ${quantity})`);
              }
            }
          }
        }
      } catch (error: any) {
        // Si es un error de validación de stock, lanzarlo
        if (error instanceof BadRequestException || error instanceof NotFoundException) {
          throw error;
        }
        // Si hay error parseando items, continuar sin restar stock (compatibilidad hacia atrás)
        console.warn('[PedidosService] Error procesando items para restar stock:', error.message);
      }
    }
    
    const entity = this.repo.create(data);
    const saved = await this.repo.save(entity);
    
    // Publicar evento en RabbitMQ para procesamiento asíncrono
    if (this.eventsPublisher) {
      await this.eventsPublisher.pedidoCreated(saved).catch((error) => {
        console.error('Error publicando evento pedido.creado:', error);
        // No lanzar error para no bloquear la creación del pedido
      });
    }
    
    return saved;
  }

  findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  findByUserId(userId: number) {
    return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  findOne(id: number) {
    return this.repo.findOneBy({ id });
  }

  async update(id: number, data: Partial<Pedido>) {
    const found = await this.repo.findOneBy({ id });
    if (!found) throw new NotFoundException('Pedido no encontrado');
    
    const oldStatus = found.orderStatus;
    Object.assign(found, data);
    const saved = await this.repo.save(found);
    
    // Publicar evento si cambió el estado
    if (this.eventsPublisher && oldStatus !== saved.orderStatus) {
      await this.eventsPublisher.pedidoStatusChanged(
        saved.id,
        oldStatus,
        saved.orderStatus,
      ).catch((error) => {
        console.error('Error publicando evento pedido.estado_cambiado:', error);
      });
    }
    
    // Publicar evento de actualización
    if (this.eventsPublisher) {
      await this.eventsPublisher.pedidoUpdated(saved).catch((error) => {
        console.error('Error publicando evento pedido.actualizado:', error);
      });
    }
    
    return saved;
  }

  async remove(id: number) {
    const res = await this.repo.delete(id);
    if (!res.affected) throw new NotFoundException('Pedido no encontrado');
    return { deleted: true };
  }

  // Nuevos métodos para el sistema de ventas
  async createCashOnDeliveryOrder(orderData: any) {
    // Validar y restar stock antes de crear el pedido
    if (orderData.items && Array.isArray(orderData.items)) {
      for (const item of orderData.items) {
        const productId = item.productId || item.id;
        const quantity = Number(item.quantity || item.qty || item.cantidad || 1);
        
        if (productId && this.productosService) {
          const product = await this.productosService.findOne(productId);
          if (!product) {
            throw new NotFoundException(`Producto con ID ${productId} no encontrado`);
          }
          
          if (product.stock < quantity) {
            throw new BadRequestException(
              `Stock insuficiente para ${product.name}. Disponible: ${product.stock}, Solicitado: ${quantity}`
            );
          }
        }
      }
      
      // Restar stock
      for (const item of orderData.items) {
        const productId = item.productId || item.id;
        const quantity = Number(item.quantity || item.qty || item.cantidad || 1);
        
        if (productId && this.productosService) {
          const product = await this.productosService.findOne(productId);
          if (product) {
            const oldStock = product.stock;
            const newStock = Math.max(0, oldStock - quantity);
            await this.productosService.update(productId, { stock: newStock });
            console.log(`[PedidosService] Stock actualizado (contra entrega): ${product.name} - ${oldStock} → ${newStock} (restado ${quantity})`);
          }
        }
      }
    }
    
    // Generar número de pedido único
    const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const orderEntity = this.repo.create({
      orderNumber,
      customerName: orderData.customerName,
      customerDni: orderData.customerDni,
      customerEmail: orderData.customerEmail,
      customerPhone: orderData.customerPhone,
      shippingAddress: orderData.shippingAddress,
      items: JSON.stringify(orderData.items),
      subtotal: orderData.subtotal,
      shipping: orderData.shipping || 0,
      total: orderData.total,
      paymentMethod: 'CASH_ON_DELIVERY',
      paymentStatus: 'PENDING',
      orderStatus: 'PENDING',
      notes: orderData.notes || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return this.repo.save(orderEntity);
  }

  async getOrderByPaymentId(paymentId: string) {
    return this.repo.findOne({
      where: { stripePaymentId: paymentId },
    });
  }

  async getOrderById(orderId: string) {
    // Intentar buscar por ID numérico primero
    if (!isNaN(Number(orderId))) {
      const orderById = await this.repo.findOneBy({ id: Number(orderId) });
      if (orderById) return orderById;
    }

    // Buscar por orderNumber si no es un ID numérico
    return this.repo.findOne({
      where: { orderNumber: orderId },
    });
  }

  async updateOrderStatus(
    orderId: number,
    status: Pedido['orderStatus'],
    paymentId?: string,
  ) {
    const order = await this.repo.findOneBy({ id: orderId });
    if (!order) {
      throw new NotFoundException('Pedido no encontrado');
    }

    const oldStatus = order.orderStatus;
    order.orderStatus = status;
    order.updatedAt = new Date();

    if (paymentId) {
      order.stripePaymentId = paymentId;
      order.paymentStatus = 'COMPLETED';
    }

    const saved = await this.repo.save(order);
    
    // Publicar evento de cambio de estado
    if (this.eventsPublisher && oldStatus !== saved.orderStatus) {
      await this.eventsPublisher.pedidoStatusChanged(
        saved.id,
        oldStatus,
        saved.orderStatus,
      ).catch((error) => {
        console.error('Error publicando evento pedido.estado_cambiado:', error);
      });
    }
    
    // Publicar evento de actualización
    if (this.eventsPublisher) {
      await this.eventsPublisher.pedidoUpdated(saved).catch((error) => {
        console.error('Error publicando evento pedido.actualizado:', error);
      });
    }

    return saved;
  }
}
