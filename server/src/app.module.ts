import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { ConfigModule } from './config/config.module';
import { SharedModule } from './shared/shared.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { GenerationModule } from './modules/generation/generation.module';
import { SseModule } from './modules/sse/sse.module';
import { ObservabilityModule } from './modules/observability/observability.module';
import { LlmModule } from './modules/llm/llm.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { ChatModule } from './modules/chat/chat.module';
import { McpModule } from './modules/mcp/mcp.module';
import { HealthController } from './health.controller';
import type { AppConfiguration } from './config/configuration.interface';

@Module({
  imports: [
    ConfigModule,
    SharedModule,
    PrismaModule,
    AuthModule,
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService<AppConfiguration, true>) => {
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
    ObservabilityModule,
    LlmModule,
    GenerationModule,
    DocumentsModule,
    ChatModule,
    McpModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
