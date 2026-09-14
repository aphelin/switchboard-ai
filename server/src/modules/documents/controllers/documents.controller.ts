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
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/types/auth.types';
import type { UploadedFileLike } from '../types/documents.types';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly documentsService: DocumentsService,
    private readonly retrievalService: RetrievalService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateDocumentDto) {
    return this.documentsService.create(user.id, dto);
  }

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: RAG.MAX_UPLOAD_BYTES } }),
  )
  upload(
    @CurrentUser() user: AuthUser,
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
    return this.documentsService.upload(user.id, file, dto.title);
  }

  @Post('search')
  @HttpCode(HttpStatus.OK)
  async search(@CurrentUser() user: AuthUser, @Body() dto: SearchDocumentsDto) {
    const results = await this.retrievalService.search({
      ...dto,
      userId: user.id,
    });
    return { query: dto.query, mode: dto.mode ?? 'hybrid', results };
  }

  @Get()
  findAll(@CurrentUser() user: AuthUser, @Query() query: QueryDocumentsDto) {
    return this.documentsService.findAll(user.id, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentsService.findOne(user.id, id);
  }

  @Get(':id/chunks')
  chunks(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentsService.getChunks(user.id, id);
  }

  @Post(':id/reindex')
  @HttpCode(HttpStatus.OK)
  reindex(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentsService.reindex(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentsService.remove(user.id, id);
  }
}
