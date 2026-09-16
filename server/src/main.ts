import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { toNodeHandler } from 'better-auth/node';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { AUTH_INSTANCE } from './modules/auth/auth.constants';
import type { Auth } from './modules/auth/auth.instance';
import type { AppConfiguration } from './config/configuration.interface';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    // Better Auth reads the raw request body, so body parsers are registered below, after its handler.
    bodyParser: false,
  });

  const configService =
    app.get<ConfigService<AppConfiguration, true>>(ConfigService);
  const appConfig = configService.get('app', { infer: true });

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');

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

  // Sign-up, sign-in, sessions and API keys are served by Better Auth itself.
  const auth = app.get<Auth>(AUTH_INSTANCE);
  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.all('/api/auth/*splat', toNodeHandler(auth));

  // Chat requests carry the whole conversation (tool results included) and, on the turn that adds them, attached images as data URLs.
  app.useBodyParser('json', { limit: '12mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '1mb' });

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
