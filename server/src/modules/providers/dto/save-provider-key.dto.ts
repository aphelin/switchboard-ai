import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** Validation messages never echo the submitted value. */
export class SaveProviderKeyDto {
  @IsString()
  @MinLength(20, { message: 'apiKey is too short to be a provider API key' })
  @MaxLength(512, { message: 'apiKey is too long' })
  @Matches(/^\s*\S+\s*$/, { message: 'apiKey must not contain spaces' })
  apiKey: string;
}
