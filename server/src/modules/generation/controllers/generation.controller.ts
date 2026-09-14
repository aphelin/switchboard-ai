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
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/types/auth.types';
import { JobStatus } from 'generated/prisma/enums';

@Controller('generations')
export class GenerationController {
  constructor(
    private readonly generationService: GenerationService,
    private readonly storage: StorageService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGenerationDto) {
    return this.generationService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryGenerationDto) {
    return this.generationService.findAll(user.id, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.generationService.findOne(user.id, id);
  }

  /**
   * Serves the stored image bytes to its owner (the browser sends the session
   * cookie with <img> requests). Galleries load many at once, so it is not rate limited.
   */
  @Get(':id/image')
  @SkipAllThrottles()
  async image(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const generation = await this.generationService.findOne(user.id, id);
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
    // Private: the image belongs to one user, so shared caches must not store it.
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    this.storage.createReadStream(storageKey).pipe(res);
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  retry(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.generationService.retry(user.id, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.generationService.cancel(user.id, id);
  }
}
