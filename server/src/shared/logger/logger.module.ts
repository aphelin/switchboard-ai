import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { NODE_ENVIRONMENTS } from '../constants/app.constants';

const isDevelopment = process.env.NODE_ENV !== NODE_ENVIRONMENTS.PRODUCTION;

const devTransport = {
  target: 'pino-pretty',
  options: {
    colorize: true,
    levelFirst: true,
    translateTime: 'SYS:standard',
  },
};

const requestSerializer = (req: { method: string; url: string }) => ({
  method: req.method,
  url: req.url,
});

const responseSerializer = (res: { statusCode: number }) => ({
  statusCode: res.statusCode,
});

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        transport: isDevelopment ? devTransport : undefined,
        level: isDevelopment ? 'debug' : 'info',
        autoLogging: true,
        serializers: {
          req: requestSerializer,
          res: responseSerializer,
        },
      },
    }),
  ],
})
export class LoggerModule {}
