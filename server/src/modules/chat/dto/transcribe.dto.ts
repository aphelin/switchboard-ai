import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Multipart fields sent with the recording (`audio`). */
export class TranscribeDto {
  /** The conversation the text is for, so the call shows under its trace. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  conversationId?: string;
}
