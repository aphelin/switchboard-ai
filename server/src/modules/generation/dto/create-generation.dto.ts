import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsUUID,
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
export class ImageParametersDto {
  /**
   * Image catalog id (GET /api/providers, `imageModels`), e.g. "platform:flux"
   * or "google:gemini-3.1-flash-image"; bare legacy ids like "flux" still work.
   * Checked against the catalog and the user's stored keys by the service.
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

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

  /**
   * Edit an existing image instead of drawing a new one: the id of one of the
   * user's finished image generations. The model must be able to edit
   * (`capabilities.edit` in the catalog); with no model named, the included
   * editing model is used.
   */
  @IsOptional()
  @IsUUID()
  sourceGenerationId?: string;
}

export class TextParametersDto {
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

  /**
   * Catalog model id (GET /api/providers) for text generation and prompt
   * enhancement; default: the included model. Checked against the catalog and
   * the user's stored keys by the service.
   */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  llmModel?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ImageParametersDto)
  parameters?: ImageParametersDto | TextParametersDto;
}
