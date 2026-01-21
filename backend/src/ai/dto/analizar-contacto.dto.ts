import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class AnalizarContactoDto {
  @IsString()
  @MinLength(2)
  nombre: string;

  @IsString()
  @MinLength(3)
  mensaje: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
