import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'events';
import * as amqplib from 'amqplib';

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqService.name);
  private connection: amqplib.ChannelModel;
  private channel: amqplib.Channel;

  /** EventEmitter that fires `result:<bidNumber>` events with the parsed payload. */
  readonly results = new EventEmitter();

  static readonly EXCHANGE = 'hello_exchange';
  static readonly ANALYSIS_EXCHANGE = 'analysis_exchange';
  static readonly RESULTS_EXCHANGE = 'analysis_results_exchange';

  constructor(private readonly config: ConfigService) {
    // Allow many concurrent SSE listeners per bid
    this.results.setMaxListeners(200);
  }

  async onModuleInit() {
    const url = this.config.get<string>('RABBITMQ_URL', 'amqp://localhost');
    this.connection = await amqplib.connect(url);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(RabbitmqService.EXCHANGE, 'fanout', {
      durable: true,
    });
    await this.channel.assertExchange(
      RabbitmqService.ANALYSIS_EXCHANGE,
      'fanout',
      { durable: true },
    );
    await this.channel.assertExchange(
      RabbitmqService.RESULTS_EXCHANGE,
      'fanout',
      { durable: true },
    );

    // ── Consume results from the Python service ─────────────────
    await this.consumeResults();

    this.logger.log('Connected to RabbitMQ. Exchanges ready.');
  }

  /** Subscribe to analysis_results_exchange and emit events in-memory. */
  private async consumeResults(): Promise<void> {
    const { queue } = await this.channel.assertQueue('', { exclusive: true });
    await this.channel.bindQueue(queue, RabbitmqService.RESULTS_EXCHANGE, '');

    this.channel.consume(
      queue,
      (msg) => {
        if (!msg) return;
        try {
          const data = JSON.parse(msg.content.toString());
          const bidNumber: string = data.bidNumber ?? 'UNKNOWN';
          this.logger.log(
            `📥 Result received for bid=${bidNumber} status=${data.status}`,
          );
          console.log('📦 Full result payload:', JSON.stringify(data, null, 2));
          this.results.emit(`result:${bidNumber}`, data);
        } catch (err) {
          this.logger.error('Failed to parse result message', err);
        }
        this.channel.ack(msg);
      },
      { noAck: false },
    );

    this.logger.log(
      `Listening for results on '${RabbitmqService.RESULTS_EXCHANGE}'`,
    );
  }

  async publish(payload: object): Promise<void> {
    const buffer = Buffer.from(JSON.stringify(payload));
    this.channel.publish(RabbitmqService.EXCHANGE, '', buffer, {
      contentType: 'application/json',
      persistent: true,
    });
    this.logger.log(`Published → ${JSON.stringify(payload)}`);
  }

  async publishTenderApply(payload: {
    bidUrl: string;
    bidNumber: string;
    bidDetails: object;
    companyDocuments: object[];
  }): Promise<void> {
    const message = {
      type: 'tender_apply',
      ...payload,
      timestamp: new Date().toISOString(),
    };
    const buffer = Buffer.from(JSON.stringify(message));
    this.channel.publish(RabbitmqService.ANALYSIS_EXCHANGE, '', buffer, {
      contentType: 'application/json',
      persistent: true,
    });
    this.logger.log(`Tender apply published for bid=${payload.bidNumber}`);
  }

  /**
   * Publish a tender_apply message and wait for the Python service to return
   * the analysis result via the results exchange.
   *
   * @param timeoutMs  How long to wait before giving up (default 5 minutes).
   */
  async publishAndWaitForResult(
    payload: {
      bidUrl: string;
      bidNumber: string;
      bidDetails: object;
      companyDocuments: object[];
    },
    timeoutMs = 5 * 60 * 1000,
  ): Promise<Record<string, unknown>> {
    // Start listening BEFORE publishing so we never miss the response
    const resultPromise = new Promise<Record<string, unknown>>(
      (resolve, reject) => {
        const event = `result:${payload.bidNumber}`;
        const timer = setTimeout(() => {
          this.results.removeListener(event, onResult);
          reject(new Error('AI analysis timed out. Please try again later.'));
        }, timeoutMs);

        const onResult = (data: Record<string, unknown>) => {
          clearTimeout(timer);
          resolve(data);
        };

        this.results.once(event, onResult);
      },
    );

    // Now publish
    await this.publishTenderApply(payload);

    // Wait for the Python service to respond
    return resultPromise;
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }
}
