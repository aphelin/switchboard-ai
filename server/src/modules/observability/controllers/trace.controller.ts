import { Controller, Get, Query } from '@nestjs/common';
import { TraceService } from '../services/trace.service';
import { QueryTracesDto } from '../dto/query-traces.dto';

@Controller('traces')
export class TraceController {
  constructor(private readonly traceService: TraceService) {}

  @Get()
  list(@Query() query: QueryTracesDto) {
    return this.traceService.list({
      traceId: query.traceId,
      name: query.name,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    });
  }

  @Get('summary')
  summary() {
    return this.traceService.summary();
  }
}
