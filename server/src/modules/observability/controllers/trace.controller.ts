import { Controller, Get, Query } from '@nestjs/common';
import { TraceService } from '../services/trace.service';
import { QueryTracesDto } from '../dto/query-traces.dto';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthUser } from '../../auth/types/auth.types';

/** Users see the traces (and costs) of their own calls only. */
@Controller('traces')
export class TraceController {
  constructor(private readonly traceService: TraceService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: QueryTracesDto) {
    return this.traceService.list({
      userId: user.id,
      traceId: query.traceId,
      name: query.name,
      sort: query.sort,
      order: query.order,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    });
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.traceService.summary(user.id);
  }
}
