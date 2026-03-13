import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  MinLength,
  MaxLength,
  IsNumber,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  GenerationType,
  JobPriority,
} from '../../../../generated/prisma/enums.js';
import {
  ImageModel,
  TextModel,
} from '../../../shared/constants/models.constants.js';

export class ImageParametersDto {
  @IsOptional()
  @IsEnum(ImageModel)
  model?: ImageModel;

  @IsOptional()
  @IsNumber()
  @Min(256)
  @Max(2048)
  width?: number;

  @IsOptional()
  @IsNumber()
  @Min(256)
  @Max(2048)
  height?: number;

  @IsOptional()
  @IsNumber()
  seed?: number;

  @IsOptional()
  @IsString()
  negativePrompt?: string;
}

export class TextParametersDto {
  @IsOptional()
  @IsEnum(TextModel)
  model?: TextModel;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsString()
  systemPrompt?: string;
}

export class CreateGenerationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  prompt: string;

  @IsEnum(GenerationType)
  type: GenerationType;

  @IsOptional()
  @IsBoolean()
  enhance?: boolean;

  @IsOptional()
  @IsEnum(JobPriority)
  priority?: JobPriority;

  @IsOptional()
  @ValidateNested()
  @Type(() => ImageParametersDto)
  parameters?: ImageParametersDto | TextParametersDto;
}
