import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { HsnGenerationService } from './hsn-generation.service';

@Controller()
export class HsnGenerationController {
  private readonly logger = new Logger(HsnGenerationController.name);

  constructor(private readonly hsnService: HsnGenerationService) {}

  /**
   * Listens to the RabbitMQ queue where FastAPI publishes the completed HSNs.
   * Make sure FastAPI sends the response to this pattern.
   */
  @EventPattern('hsn_generation_result')
  async handleHsnResult(@Payload() data: any) {
    this.logger.log('Incoming AI HSN results from RabbitMQ...');
    await this.hsnService.handleAiResults(data);
  }
}
