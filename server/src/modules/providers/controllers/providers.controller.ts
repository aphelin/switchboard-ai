import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Put,
} from '@nestjs/common';
import { ModelRouterService } from '../services/model-router.service';
import { ProviderCredentialsService } from '../services/provider-credentials.service';
import { SaveProviderKeyDto } from '../dto/save-provider-key.dto';
import { ByokProvider } from '../../llm/catalog/model-catalog';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/types/auth.types';

const providerParam = new ParseEnumPipe(ByokProvider);

@Controller('providers')
export class ProvidersController {
  constructor(
    private readonly router: ModelRouterService,
    private readonly credentials: ProviderCredentialsService,
  ) {}

  /** Models the user can pick, grouped by provider, with which providers have a stored key. */
  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.router.listForUser(user.id);
  }

  /** Verifies the key with the provider, then stores it encrypted. Responds with the last 4 characters only. */
  @Put(':provider/key')
  saveKey(
    @CurrentUser() user: AuthUser,
    @Param('provider', providerParam) provider: ByokProvider,
    @Body() dto: SaveProviderKeyDto,
  ) {
    return this.credentials.save(user.id, provider, dto.apiKey);
  }

  @Delete(':provider/key')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeKey(
    @CurrentUser() user: AuthUser,
    @Param('provider', providerParam) provider: ByokProvider,
  ): Promise<void> {
    await this.credentials.remove(user.id, provider);
  }
}
