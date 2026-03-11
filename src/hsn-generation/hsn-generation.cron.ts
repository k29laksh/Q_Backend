import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HsnGenerationService } from './hsn-generation.service';

@Injectable()
export class HsnGenerationCron {
  private readonly logger = new Logger(HsnGenerationCron.name);

  constructor(private readonly hsnService: HsnGenerationService) {}

  // Triggers every 5 minutes
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCron() {
    try {
      this.logger.log('Cron triggered: Checking for PENDING bids...');
      await this.hsnService.dispatchPendingBids();
    } catch (error) {
      this.logger.error(`HSN Cron Job Failed: ${error.message}`, error.stack);
    }
  }
}
