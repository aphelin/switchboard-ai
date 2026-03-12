import type { AppConfiguration } from './configuration.interface';

export const configuration = (): AppConfiguration => ({
  app: {
    port: parseInt(process.env.SERVER_PORT || '4000', 10),
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
    },
  },
  database: {
    url: process.env.DATABASE_URL!,
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  pollinations: {
    apiKey: process.env.POLLINATIONS_API_KEY!,
    baseUrl: 'https://gen.pollinations.ai',
  },
});
