import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BidPlusGemPortalMinistryMaster } from '../entity/bid-plus-gem-portal-ministry-master.entity';
import { BidPlusGemPortalOrganizationMaster } from '../entity/bid-plus-gem-portal-organization-master.entity';
import { GemBidData } from '../entity/bid-data.entity';
import { BidPlusGemPortalScrapingService } from './bid-plus-gem-portal-scraping.service';
import { ScrapingController } from './scraping.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BidPlusGemPortalMinistryMaster,
      BidPlusGemPortalOrganizationMaster,
      GemBidData,
    ]),
  ],
  controllers: [ScrapingController],
  providers: [BidPlusGemPortalScrapingService],
})
export class ScrapingModule {}
