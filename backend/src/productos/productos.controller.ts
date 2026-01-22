import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { isValidPrice } from '../common/validation';
import { ProductosService } from './productos.service';
import { EventsService } from '../realtime/events.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import * as fs from 'fs';
import { join } from 'path';
import sharp from 'sharp';

@Controller('api/productos')
export class ProductosController {
  constructor(
    private readonly productosService: ProductosService,
    private readonly events: EventsService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'VENDEDOR')
  @UseInterceptors(
    FileInterceptor('image', { storage: multer.memoryStorage() }),
  )
  async create(@UploadedFile() file: Express.Multer.File, @Body() body: any) {
    // Validación de precio (mínimo 0.01)
    if (body.price === undefined || !isValidPrice(body.price)) {
      throw new BadRequestException(
        'El precio debe ser un número positivo (mínimo 0.01)',
      );
    }
    // If no file provided, fallback to simple create
    let imageUrl: string | undefined;
    let thumbnailUrl: string | undefined;

    if (file) {
      // Validate mime type
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(file.mimetype)) {
        throw new BadRequestException(
          'Formato no permitido. Use JPG, PNG o WEBP.',
        );
      }

      /* 
      // Validate size <= 5MB
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new BadRequestException(
          'La imagen supera el tamaño máximo de 5MB.',
        );
      }
      // Validate dimensions >= 400x300 (relajado)
      const meta = await sharp(file.buffer).metadata();
      const w = meta.width ?? 0;
      const h = meta.height ?? 0;
      if (w < 400 || h < 300) {
        throw new BadRequestException(
          'La imagen debe tener mínimamente 400x300px.',
        );
      }
      */

      // Ensure directories exist
      const uploadsDir = join(process.cwd(), 'public', 'uploads', 'products');
      const thumbsDir = join(uploadsDir, 'thumbs');
      fs.mkdirSync(uploadsDir, { recursive: true });
      fs.mkdirSync(thumbsDir, { recursive: true });

      // Generate filename
      const ext =
        file.mimetype === 'image/png'
          ? 'png'
          : file.mimetype === 'image/webp'
            ? 'webp'
            : 'jpg';
      const base = `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const filename = `${base}.${ext}`;

      // Optimize main image (max width 1600)
      const mainOutput = join(uploadsDir, filename);
      let pipeline = sharp(file.buffer).rotate();
      pipeline = pipeline.resize({ width: 1600, withoutEnlargement: true });
      if (ext === 'jpg') pipeline = pipeline.jpeg({ quality: 82 });
      else if (ext === 'png') pipeline = pipeline.png({ quality: 82 });
      else pipeline = pipeline.webp({ quality: 82 });
      await pipeline.toFile(mainOutput);

      // Thumbnail (width 400)
      const thumbOutput = join(thumbsDir, filename);
      let thumbPipe = sharp(file.buffer)
        .rotate()
        .resize({ width: 400, withoutEnlargement: true });
      if (ext === 'jpg') thumbPipe = thumbPipe.jpeg({ quality: 80 });
      else if (ext === 'png') thumbPipe = thumbPipe.png({ quality: 80 });
      else thumbPipe = thumbPipe.webp({ quality: 80 });
      await thumbPipe.toFile(thumbOutput);

      imageUrl = `/uploads/products/${filename}`;
      thumbnailUrl = `/uploads/products/thumbs/${filename}`;
    }

    const created = await this.productosService.create({
      name: body.name,
      description: body.description,
      price: Number(body.price ?? 0),
      stock: Number(body.stock ?? 0),
      category: body.category,
      imageUrl,
      thumbnailUrl,
    });
    this.events.productosUpdated({ id: created.id, action: 'create' });
    return created;
  }

  @Get()
  findAll(@Query('q') q?: string, @Query('category') category?: string) {
    return this.productosService.findAll({ q, category });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productosService.findOne(Number(id));
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'VENDEDOR')
  @UseInterceptors(
    FileInterceptor('image', { storage: multer.memoryStorage() }),
  )
  async update(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: any,
  ) {
    if (body.price !== undefined && !isValidPrice(body.price)) {
      throw new BadRequestException(
        'El precio debe ser un número positivo (mínimo 0.01)',
      );
    }

    // Si se sube una nueva imagen, procesarla
    let imageUrl: string | undefined;
    let thumbnailUrl: string | undefined;

    if (file) {
      // Validate mime type
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(file.mimetype)) {
        throw new BadRequestException(
          'Formato no permitido. Use JPG, PNG o WEBP.',
        );
      }

      // Ensure directories exist
      const uploadsDir = join(process.cwd(), 'public', 'uploads', 'products');
      const thumbsDir = join(uploadsDir, 'thumbs');
      fs.mkdirSync(uploadsDir, { recursive: true });
      fs.mkdirSync(thumbsDir, { recursive: true });

      // Generate filename
      const ext =
        file.mimetype === 'image/png'
          ? 'png'
          : file.mimetype === 'image/webp'
            ? 'webp'
            : 'jpg';
      const base = `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const filename = `${base}.${ext}`;

      // Optimize main image (max width 1600)
      const mainOutput = join(uploadsDir, filename);
      let pipeline = sharp(file.buffer).rotate();
      pipeline = pipeline.resize({ width: 1600, withoutEnlargement: true });
      if (ext === 'jpg') pipeline = pipeline.jpeg({ quality: 82 });
      else if (ext === 'png') pipeline = pipeline.png({ quality: 82 });
      else pipeline = pipeline.webp({ quality: 82 });
      await pipeline.toFile(mainOutput);

      // Thumbnail (width 400)
      const thumbOutput = join(thumbsDir, filename);
      let thumbPipe = sharp(file.buffer)
        .rotate()
        .resize({ width: 400, withoutEnlargement: true });
      if (ext === 'jpg') thumbPipe = thumbPipe.jpeg({ quality: 80 });
      else if (ext === 'png') thumbPipe = thumbPipe.png({ quality: 80 });
      else thumbPipe = thumbPipe.webp({ quality: 80 });
      await thumbPipe.toFile(thumbOutput);

      imageUrl = `/uploads/products/${filename}`;
      thumbnailUrl = `/uploads/products/thumbs/${filename}`;
    }

    // Preparar datos de actualización
    const updateData: any = {
      name: body.name,
      description: body.description,
      price: body.price !== undefined ? Number(body.price) : undefined,
      stock: body.stock !== undefined ? Number(body.stock) : undefined,
      category: body.category,
    };

    // Solo actualizar imágenes si se subió una nueva
    if (imageUrl && thumbnailUrl) {
      updateData.imageUrl = imageUrl;
      updateData.thumbnailUrl = thumbnailUrl;
    }

    // Eliminar campos undefined
    Object.keys(updateData).forEach(
      (key) => updateData[key] === undefined && delete updateData[key],
    );

    return this.productosService.update(Number(id), updateData).then((p) => {
      this.events.productosUpdated({ id: Number(id), action: 'update' });
      return p;
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.productosService.remove(Number(id)).then(() => {
      this.events.productosUpdated({ id: Number(id), action: 'delete' });
      return { ok: true };
    });
  }
}
