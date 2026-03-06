import { Controller, Get, Param, Sse, Logger } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { EventEmitter } from 'events';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';

interface MessageEvent {
  data: string | object;
  type?: string;
  id?: string;
}

@ApiTags('Tender Results')
@Controller('tender-results')
export class TenderResultsController {
  private readonly logger = new Logger(TenderResultsController.name);
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  private readonly resultEmitter: EventEmitter;

  constructor(private readonly rabbitmq: RabbitmqService) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.resultEmitter = this.rabbitmq.results;
  }

  /**
   * SSE stream – the client subscribes after calling tender_apply.
   * As soon as the Python service publishes a result for this bidNumber,
   * it is pushed to the client and the stream closes.  No database involved.
   *
   * Usage: `GET /tender-results/:bidNumber/stream`
   * (EventSource or fetch with ReadableStream on the frontend)
   */
  @Get(':bidNumber/stream')
  @Sse()
  @ApiParam({ name: 'bidNumber', example: 'GEM/2025/B/6756124' })
  @ApiOperation({
    summary: 'Stream analysis result for a bid (SSE)',
    description:
      'Opens a Server-Sent Events stream. The response is sent once the ' +
      'Python AI service finishes processing and publishes the result to ' +
      'analysis_results_exchange. No data is stored — it is forwarded directly.',
  })
  streamResult(
    @Param('bidNumber') bidNumber: string,
  ): Observable<MessageEvent> {
    this.logger.log(`SSE client connected for bid=${bidNumber}`);

    return new Observable<MessageEvent>((subscriber) => {
      // Send a heartbeat so the client knows the connection is alive
      subscriber.next({
        type: 'connected',
        data: { bidNumber, status: 'waiting' },
      });

      const onResult = (data: Record<string, unknown>) => {
        this.logger.log(`Forwarding result to SSE client for bid=${bidNumber}`);
        subscriber.next({ type: 'result', data });
        // Result delivered — close the stream
        subscriber.complete();
      };

      const eventName = `result:${bidNumber}`;
      this.resultEmitter.once(eventName, onResult);

      // Cleanup if the client disconnects before the result arrives
      return () => {
        this.resultEmitter.removeListener(eventName, onResult);
        this.logger.log(`SSE client disconnected for bid=${bidNumber}`);
      };
    });
  }
}
