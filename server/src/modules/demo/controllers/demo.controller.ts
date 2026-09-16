import { Controller, Get } from '@nestjs/common';
import { Public } from '../../auth/decorators/public.decorator';
import { DemoGuestsService } from '../services/demo-guests.service';
import type { DemoStatus } from '../types/demo.types';

@Controller('demo')
export class DemoController {
  constructor(private readonly guests: DemoGuestsService) {}

  /** Whether one-click guest sessions are open, and their limits. Guests sign in at POST /api/auth/sign-in/anonymous. */
  @Public()
  @Get()
  status(): DemoStatus {
    return this.guests.status();
  }
}
