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
} from '@nestjs/common';
import { GenerationService } from '../services/generation.service';
import { CreateGenerationDto } from '../dto/create-generation.dto';
import { QueryGenerationDto } from '../dto/query-generation.dto';

@Controller('generations')
export class GenerationController {
  constructor(private readonly generationService: GenerationService) {}

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
