import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardKpi } from '../entity/dashboard-kpi.entity';
import { Customer } from '../entity/customer.entity';
import { CustomerHsn } from '../entity/customer-hsn-codes.entity';
import { GemBidData } from '../entity/bid-data.entity';
import { TenderActivity } from '../entity/tender-activity.entity';
import { UserBidInteraction } from '../entity/user-bid-interaction.entity';
import { SeedService } from './seed.service';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            DashboardKpi,
            Customer,
            CustomerHsn,
            GemBidData,
            TenderActivity,
            UserBidInteraction,
        ]),
    ],
    controllers: [DashboardController],
    providers: [DashboardService, SeedService],
    exports: [DashboardService],
})
export class DashboardModule { }