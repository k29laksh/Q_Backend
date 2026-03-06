import { Controller, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RabbitmqService } from './rabbitmq.service';

@ApiTags('RabbitMQ')
@Controller('rabbitmq')
export class RabbitmqController {
  constructor(private readonly rabbitmq: RabbitmqService) {}

  @Post('hello')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Publish a hello message to FastAPI via RabbitMQ' })
  async sendHello() {
    await this.rabbitmq.publish({
      from: 'NestJS',
      message: 'Hello from NestJS!',
      timestamp: new Date().toISOString(),
    });
    return {
      status: 'published',
      exchange: RabbitmqService.EXCHANGE,
    };
  }
}
