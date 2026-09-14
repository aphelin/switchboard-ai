import {
  Controller,
  Delete,
  Get,
  Logger,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import type { Request, Response } from 'express';
import { McpService } from '../services/mcp.service';
import { SkipAllThrottles } from '../../../shared/decorators/skip-all-throttles.decorator';

const METHOD_NOT_ALLOWED = {
  jsonrpc: '2.0',
  error: { code: -32000, message: 'Method not allowed.' },
  id: null,
} as const;

/**
 * MCP endpoint (Streamable HTTP, stateless): `POST /api/mcp`.
 * Each request gets its own server + transport, so there are no sessions to
 * track and the endpoint scales horizontally. GET (SSE resumption) and DELETE
 * (session teardown) only make sense for stateful servers and return 405.
 * MCP clients burst several requests on connect, so the route is not throttled.
 */
@Controller('mcp')
@SkipAllThrottles()
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(private readonly mcpService: McpService) {}

  @Post()
  async handle(@Req() req: Request, @Res() res: Response): Promise<void> {
    const server = this.mcpService.createServer();
    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      this.logger.error(
        `MCP request failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  }

  @Get()
  methodNotAllowedGet(@Res() res: Response): void {
    res.status(405).json(METHOD_NOT_ALLOWED);
  }

  @Delete()
  methodNotAllowedDelete(@Res() res: Response): void {
    res.status(405).json(METHOD_NOT_ALLOWED);
  }
}
