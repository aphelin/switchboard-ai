import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { ThrottlerException, ThrottlerStorageService } from '@nestjs/throttler';
import { McpController } from './mcp.controller';
import { UserThrottlerGuard } from '../../auth/guards/user-throttler.guard';
import {
  MCP_THROTTLE,
  THROTTLE_CONFIGS,
} from '../../../shared/constants/app.constants';

const contextFor = (userId: string): ExecutionContext =>
  ({
    // The guard only uses the handler as a metadata key.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    getHandler: () => McpController.prototype.handle,
    getClass: () => McpController,
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: userId }, ip: '10.0.0.1', headers: {} }),
      getResponse: () => ({ header: () => undefined }),
    }),
  }) as unknown as ExecutionContext;

describe('McpController throttling', () => {
  it('throttles MCP requests per user', async () => {
    const guard = new UserThrottlerGuard(
      { throttlers: [...THROTTLE_CONFIGS] },
      new ThrottlerStorageService(),
      new Reflector(),
    );
    await guard.onModuleInit();

    for (let i = 0; i < MCP_THROTTLE.short.limit; i++) {
      await expect(guard.canActivate(contextFor('alice'))).resolves.toBe(true);
    }
    await expect(guard.canActivate(contextFor('alice'))).rejects.toBeInstanceOf(
      ThrottlerException,
    );
    // The limit is per user: another user behind the same IP is unaffected.
    await expect(guard.canActivate(contextFor('bob'))).resolves.toBe(true);
  });
});
