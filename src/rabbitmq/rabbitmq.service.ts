import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqplib from 'amqplib';

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqService.name);
  private connection: amqplib.ChannelModel;
  private channel: amqplib.Channel;

  static readonly EXCHANGE = 'hello_exchange';
  static readonly ANALYSIS_EXCHANGE = 'analysis_exchange';

  constructor(private readonly config: ConfigService) {}

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
    this.logger.log('Connected to RabbitMQ. Exchanges ready.');
  }

  async publish(payload: object): Promise<void> {
    const buffer = Buffer.from(JSON.stringify(payload));
    this.channel.publish(RabbitmqService.EXCHANGE, '', buffer, {
      contentType: 'application/json',
      persistent: true,
    });
    this.logger.log(`Published → ${JSON.stringify(payload)}`);
  }

  async publishAnalysis(userId: string): Promise<void> {
    const payload = {
      type: 'analysis_request',
      userId,
      timestamp: new Date().toISOString(),
    };
    const buffer = Buffer.from(JSON.stringify(payload));
    this.channel.publish(RabbitmqService.ANALYSIS_EXCHANGE, '', buffer, {
      contentType: 'application/json',
      persistent: true,
    });
    this.logger.log(`Analysis request published for userId=${userId}`);
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }
}
