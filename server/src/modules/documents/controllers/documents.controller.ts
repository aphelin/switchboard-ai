import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from '../services/documents.service';
import { RetrievalService } from '../services/retrieval.service';
import { CreateDocumentDto } from '../dto/create-document.dto';
import { UploadDocumentDto } from '../dto/upload-document.dto';
import { QueryDocumentsDto } from '../dto/query-documents.dto';
import { SearchDocumentsDto } from '../dto/search-documents.dto';
import { RAG } from '../../../shared/constants/app.constants';
import type { UploadedFileLike } from '../types/documents.types';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly retrievalService: RetrievalService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateDocumentDto) {
    return this.documentsService.create(dto);
  }

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: RAG.MAX_UPLOAD_BYTES } }),
  )
  upload(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: RAG.MAX_UPLOAD_BYTES }),
        ],
        fileIsRequired: true,
      }),
    )
    file: UploadedFileLike,
    @Body() dto: UploadDocumentDto,
  ) {
    return this.documentsService.upload(file, dto.title);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(@Body() dto: SearchDocumentsDto) {
    const results = await this.retrievalService.search(dto);
    return { query: dto.query, mode: dto.mode ?? 'hybrid', results };
  }

  @Get()
  findAll(@Query() query: QueryDocumentsDto) {
    return this.documentsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.findOne(id);
  }

  @Get(':id/chunks')
  chunks(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.getChunks(id);
  }

  @Post(':id/reindex')
  @HttpCode(HttpStatus.OK)
  reindex(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.reindex(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.remove(id);
  }
}
