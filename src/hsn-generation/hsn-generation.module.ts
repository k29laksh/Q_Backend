import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GemBidData } from '../entity/bid-data.entity'; // Adjust path
import { HsnGenerationService } from './hsn-generation.service';
import { HsnGenerationController } from './hsn-generation.controller';
import { HsnGenerationCron } from './hsn-generation.cron';

@Module({
  imports: [
    TypeOrmModule.forFeature([GemBidData]),
    ClientsModule.registerAsync([
      {
        name: 'RABBITMQ_HSN_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [
              configService.get<string>('RABBITMQ_URL') ||
                'amqp://localhost:5672',
            ],
            queue: 'hsn_requests_queue', // FastApi will listen to this queue
            queueOptions: {
              durable: true,
            },
          },
        }),
      },
    ]),
  ],
  controllers: [HsnGenerationController],
  providers: [HsnGenerationService, HsnGenerationCron],
})
export class HsnGenerationModule {}
