import * as Joi from 'joi';
import { NODE_ENVIRONMENTS } from '../shared/constants/app.constants';

export const validationSchema = Joi.object({
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().integer().positive().default(6379),
  POLLINATIONS_API_KEY: Joi.string().required(),
  SERVER_PORT: Joi.number().integer().positive().default(4000),
  CLIENT_URL: Joi.string().uri().default('http://localhost:3000'),
  NODE_ENV: Joi.string()
    .valid(NODE_ENVIRONMENTS.DEVELOPMENT, NODE_ENVIRONMENTS.PRODUCTION)
    .default(NODE_ENVIRONMENTS.DEVELOPMENT),
});
