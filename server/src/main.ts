import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import type { AppConfiguration } from './config/configuration.interface';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const configService =
    app.get<ConfigService<AppConfiguration, true>>(ConfigService);
  const appConfig = configService.get('app', { infer: true });

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
  // Chat requests carry the whole conversation (tool results included).
  app.useBodyParser('json', { limit: '5mb' });

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.enableCors({
    origin: appConfig.cors.origin,
    credentials: appConfig.cors.credentials,
    exposedHeaders: ['mcp-session-id', 'x-vercel-ai-ui-message-stream'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter(app.get(Logger)));

  await app.listen(appConfig.port);
}
bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
