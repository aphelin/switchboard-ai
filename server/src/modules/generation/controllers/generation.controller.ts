import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  NotFoundException,
  Res,
} from '@nestjs/common';
import { SkipAllThrottles } from '../../../shared/decorators/skip-all-throttles.decorator';
import type { Response } from 'express';
import { GenerationService } from '../services/generation.service';
import { CreateGenerationDto } from '../dto/create-generation.dto';
import { QueryGenerationDto } from '../dto/query-generation.dto';
import { StorageService } from '../../../shared/storage/storage.service';
import { JobStatus } from 'generated/prisma/enums';

@Controller('generations')
export class GenerationController {
  constructor(
    private readonly generationService: GenerationService,
    private readonly storage: StorageService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateGenerationDto) {
    return this.generationService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryGenerationDto) {
    return this.generationService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.generationService.findOne(id);
  }

  /** Serves the stored image bytes; gallery pages load many of these at once, so it is not rate limited. */
  @Get(':id/image')
  @SkipAllThrottles()
  async image(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const generation = await this.generationService.findOne(id);
    const storageKey = (generation.parameters as { storageKey?: string } | null)
      ?.storageKey;

    if (generation.status !== JobStatus.COMPLETED || !storageKey) {
      throw new NotFoundException('Image is not available for this generation');
    }

    const object = await this.storage.head(storageKey);
    if (!object) {
      throw new NotFoundException('Image file not found');
    }

    res.setHeader('Content-Type', object.contentType);
    res.setHeader('Content-Length', object.size);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    this.storage.createReadStream(storageKey).pipe(res);
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  retry(@Param('id', ParseUUIDPipe) id: string) {
    return this.generationService.retry(id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.generationService.cancel(id);
  }
}
