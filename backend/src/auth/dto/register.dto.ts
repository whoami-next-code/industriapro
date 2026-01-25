import {
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @Matches(/^\+51\s?(?:\d{9}|\(\d{2}\)\s?\d{7}|\d{3}\s?\d{6})$/)
  phone?: string;
}
