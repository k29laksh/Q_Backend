import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GemBidData } from '../entity/bid-data.entity';
import { Customer } from '../entity/customer.entity';
import { CustomerHsn } from '../entity/customer-hsn-codes.entity';
import { BidDataService } from './bid-data.service';
import { BidDataController } from './bid-data.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GemBidData, Customer, CustomerHsn])],
  controllers: [BidDataController],
  providers: [BidDataService],
  exports: [BidDataService],
})
export class BidDataModule {}
