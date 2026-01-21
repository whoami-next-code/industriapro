import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contacto } from './contacto.entity';
import { ContactosService } from './contactos.service';
import { ContactosController } from './contactos.controller';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/user.entity';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [TypeOrmModule.forFeature([Contacto, User]), AuthModule, MailModule],
  providers: [ContactosService],
  controllers: [ContactosController],
})
export class ContactosModule {}
