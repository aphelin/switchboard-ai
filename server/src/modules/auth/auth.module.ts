import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';
import { AUTH_INSTANCE } from './auth.constants';
import { createAuth } from './auth.instance';
import { AuthGuard } from './guards/auth.guard';
import { UserThrottlerGuard } from './guards/user-throttler.guard';
import { BudgetService } from './services/budget.service';
import { LegacyDataService } from './services/legacy-data.service';
import { MeController } from './controllers/me.controller';
import { DemoModule } from '../demo/demo.module';
import { DemoGuestsService } from '../demo/services/demo-guests.service';
import { DemoTemplateService } from '../demo/services/demo-template.service';
import type { AppConfiguration } from '../../config/configuration.interface';

@Global()
@Module({
  imports: [PrismaModule, DemoModule],
  controllers: [MeController],
  providers: [
    LegacyDataService,
    BudgetService,
    {
      provide: AUTH_INSTANCE,
      inject: [
        PrismaService,
        ConfigService,
        LegacyDataService,
        DemoGuestsService,
        DemoTemplateService,
      ],
      useFactory: (
        prisma: PrismaService,
        configService: ConfigService<AppConfiguration, true>,
        legacyData: LegacyDataService,
        demoGuests: DemoGuestsService,
        demoTemplate: DemoTemplateService,
      ) =>
        createAuth(prisma, configService.get('auth', { infer: true }), {
          onAccountCreated: (userId) => legacyData.claimForFirstAccount(userId),
          guestCreationBlock: () => demoGuests.creationBlock(),
          onGuestCreated: (userId) => demoTemplate.copyInto(userId),
        }),
    },
    // Order matters: authenticate first, then rate limit by the resolved user.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
  ],
  exports: [AUTH_INSTANCE, BudgetService],
})
export class AuthModule {}
