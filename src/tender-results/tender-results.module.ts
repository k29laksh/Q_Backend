import { Module } from '@nestjs/common';
import { TenderResultsController } from './tender-results.controller';
import { RabbitmqModule } from '../rabbitmq/rabbitmq.module';

@Module({
  imports: [RabbitmqModule],
  controllers: [TenderResultsController],
})
export class TenderResultsModule {}
