import { IsString, MinLength, MaxLength } from 'class-validator';
import { RAG } from '../../../shared/constants/app.constants';

export class CreateDocumentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @IsString()
  @MinLength(1)
  @MaxLength(RAG.MAX_DOCUMENT_CHARS)
  content: string;
}
