import {
  IsIn,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

/** Columns of the call ledger that can be sorted. */
export const TRACE_SORT_FIELDS = [
  'createdAt',
  'name',
  'model',
  'inputTokens',
  'costUsd',
  'latencyMs',
  'status',
] as const;
export type TraceSortField = (typeof TRACE_SORT_FIELDS)[number];

export class QueryTracesDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  traceId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsIn(TRACE_SORT_FIELDS)
  sort?: TraceSortField;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}
