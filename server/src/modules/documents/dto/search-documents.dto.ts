import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsArray,
  IsUUID,
  IsIn,
  ArrayMaxSize,
} from 'class-validator';
import type { SearchMode } from '../types/documents.types';

export const SEARCH_MODES: SearchMode[] = ['hybrid', 'vector', 'keyword'];

export class SearchDocumentsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  query: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  documentIds?: string[];

  @IsOptional()
  @IsIn(SEARCH_MODES)
  mode?: SearchMode;
}
