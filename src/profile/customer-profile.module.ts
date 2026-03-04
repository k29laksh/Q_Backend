import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerProfileController } from './customer-profile.controller';
import { CustomerProfileService } from './customer-profile.service';

// Import your entities
import { Customer } from '../entity/customer.entity';
import { Company } from '../entity/company.entity';
import { CustomerHsn } from 'src/entity/customer-hsn-codes.entity';
import { CompanyDocument } from '../entity/company-document.entity';

@Module({
  imports: [
    // Register all the entities this module needs to interact with
    TypeOrmModule.forFeature([Customer, Company, CustomerHsn, CompanyDocument]),
  ],
  controllers: [CustomerProfileController],
  providers: [CustomerProfileService],
  exports: [CustomerProfileService], // Export so other modules can use it if needed
})
export class ProfileModule {}
