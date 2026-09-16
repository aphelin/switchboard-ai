import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import type { ProvidersResponse } from '../types/providers.types';

const providerParam = new ParseEnumPipe(ByokProvider);

@Controller('providers')
export class ProvidersController {
  constructor(
    private readonly router: ModelRouterService,
    private readonly credentials: ProviderCredentialsService,
  ) {}

  /** Models the user can pick, grouped by provider, with which providers have a stored key. */
  @Get()
  async list(@CurrentUser() user: AuthUser): Promise<ProvidersResponse> {
    const response = await this.router.listForUser(user.id);
    return user.isGuest
      ? { ...response, byokEnabled: false, byokDisabledReason: 'guest' }
      : response;
  }

  /** Verifies the key with the provider, then stores it encrypted. Responds with the last 4 characters only. */
  @Put(':provider/key')
  saveKey(
    @CurrentUser() user: AuthUser,
    @Param('provider', providerParam) provider: ByokProvider,
    @Body() dto: SaveProviderKeyDto,
  ) {
    // Demo guests run on the included models only, and are deleted within a day.
    if (user.isGuest) {
      throw new ForbiddenException(
        'Demo sessions cannot store provider keys. Create an account to use your own OpenAI, Anthropic or Google key.',
      );
    }
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
