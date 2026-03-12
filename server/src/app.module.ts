import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { ConfigModule } from './config/config.module';
import { SharedModule } from './shared/shared.module';
import { PrismaModule } from './prisma/prisma.module';
import { GenerationModule } from './modules/generation/generation.module';
import { SseModule } from './modules/sse/sse.module';
import { HealthController } from './health.controller';
import type { AppConfiguration } from './config/configuration.interface';

@Module({
  imports: [
    ConfigModule,
    SharedModule,
    PrismaModule,
    BullModule.forRootAsync({
      useFactory: (
        configService: ConfigService<AppConfiguration, true>,
      ) => {
        const redis = configService.get('redis', { infer: true });
        return {
          connection: {
            host: redis.host,
            port: redis.port,
          },
        };
      },
      inject: [ConfigService],
    }),
    SseModule,
    GenerationModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
