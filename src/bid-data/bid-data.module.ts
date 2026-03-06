import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GemBidData } from '../entity/bid-data.entity';
import { Customer } from '../entity/customer.entity';
import { CustomerHsn } from '../entity/customer-hsn-codes.entity';
import { Company } from '../entity/company.entity';
import { CompanyDocument } from '../entity/company-document.entity';
import { BidDataService } from './bid-data.service';
import { BidDataController } from './bid-data.controller';
import { RabbitmqModule } from '../rabbitmq/rabbitmq.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([GemBidData, Customer, CustomerHsn, Company, CompanyDocument]),
    RabbitmqModule,
  ],
  controllers: [BidDataController],
  providers: [BidDataService],
  exports: [BidDataService],
})
export class BidDataModule { }
