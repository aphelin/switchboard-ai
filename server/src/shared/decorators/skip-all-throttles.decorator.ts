import { SkipThrottle } from '@nestjs/throttler';
import { THROTTLE_CONFIGS } from '../constants/app.constants';

/**
 * `@SkipThrottle()` without arguments only skips a throttler named "default";
 * ours are named (short/medium/long), so every name must be listed explicitly.
 */
export const SkipAllThrottles = () =>
  SkipThrottle(
    Object.fromEntries(THROTTLE_CONFIGS.map((config) => [config.name, true])),
  );
