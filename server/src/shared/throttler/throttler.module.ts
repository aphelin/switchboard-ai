import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerModule as NestThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';
import { THROTTLE_CONFIGS } from '../constants/app.constants';
import type { AppConfiguration } from '../../config/configuration.interface';

@Module({
  imports: [
    NestThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (
        configService: ConfigService<AppConfiguration, true>,
      ) => {
        const redis = configService.get('redis', { infer: true });
        return {
          throttlers: [...THROTTLE_CONFIGS],
          storage: new ThrottlerStorageRedisService(
            new Redis({
              host: redis.host,
              port: redis.port,
            }),
          ),
        };
      },
    }),
  ],
})
export class ThrottlerModule {}
