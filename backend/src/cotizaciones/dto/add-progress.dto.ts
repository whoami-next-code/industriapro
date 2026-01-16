import {
  IsString,
  IsOptional,
  IsNumber,
  IsArray,
  Min,
  Max,
} from 'class-validator';

export class AddProgressDto {
  @IsString({ message: 'El mensaje es requerido y debe ser texto' })
  message: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  estimatedDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachmentUrls?: string[];

  @IsOptional()
  @IsString()
  materials?: string;

  @IsOptional()
  @IsString()
  author?: string;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercent?: number;

  @IsOptional()
  @IsString()
  technician?: string;

  // Campos adicionales para actualización de datos técnicos
  @IsOptional()
  @IsString()
  technicianName?: string;

  @IsOptional()
  @IsString()
  technicianPhone?: string;

  @IsOptional()
  @IsString()
  technicianEmail?: string;

  @IsOptional()
  @IsString()
  installationTechnician?: string;

  @IsOptional()
  @IsString()
  clientMessage?: string;
}
