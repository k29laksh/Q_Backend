import { Controller, Post } from '@nestjs/common';
import { BidPlusGemPortalScrapingService } from './bid-plus-gem-portal-scraping.service';

@Controller('scraping')
export class ScrapingController {
  constructor(
    private readonly scrapingService: BidPlusGemPortalScrapingService,
  ) {}

  @Post('run')
  async runScraping() {
    return this.scrapingService.initiateScrapingRun();
  }
}
