import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { Customer } from './entity/customer.entity';
import { Company } from './entity/company.entity';
import { CompanyDocument } from './entity/company-document.entity';
import { CustomerHsn } from './entity/customer-hsn-codes.entity';

import { OnboardingDraft } from './entity/onboarding.entity';
import { OtpCode } from './entity/otp.entity';
import { GemBidData } from './entity/bid-data.entity';
import { BidPlusGemPortalMinistryMaster } from './entity/bid-plus-gem-portal-ministry-master.entity';
import { BidPlusGemPortalOrganizationMaster } from './entity/bid-plus-gem-portal-organization-master.entity';
import { BidDataModule } from './bid-data/bid-data.module';
// import { RabbitmqModule } from './rabbitmq/rabbitmq.module';
import { ProfileModule } from './profile/customer-profile.module';
import { DocumentsModule } from './documents/documents.module';
import { DashboardKpi } from './entity/dashboard-kpi.entity';
import { DashboardModule } from './dashboard/dashboard.module';
import { TenderActivity } from './entity/tender-activity.entity';
import { UserBidInteraction } from './entity/user-bid-interaction.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: [
        Customer,
        Company,
        CompanyDocument,
        CustomerHsn,
        OnboardingDraft,
        OtpCode,
        GemBidData,
        BidPlusGemPortalMinistryMaster,
        BidPlusGemPortalOrganizationMaster,
        DashboardKpi,
        TenderActivity,
        UserBidInteraction,
      ],
      synchronize: true, // Set to false in production!
    }),
    AuthModule,
    BidDataModule,
    ProfileModule,
    DocumentsModule,
    // RabbitmqModule,
    DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
