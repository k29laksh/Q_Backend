import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { DashboardKpi } from '../entity/dashboard-kpi.entity';
import { Customer } from '../entity/customer.entity';
import { GemBidData } from '../entity/bid-data.entity';
import { TenderActivity } from '../entity/tender-activity.entity';
import { UserBidInteraction } from '../entity/user-bid-interaction.entity';
import { CustomerHsn } from '../entity/customer-hsn-codes.entity';

@Injectable()
export class DashboardService {
    constructor(
        @InjectRepository(DashboardKpi)
        private readonly dashboardKpiRepository: Repository<DashboardKpi>,
        @InjectRepository(Customer)
        private readonly customerRepository: Repository<Customer>,
        @InjectRepository(GemBidData)
        private readonly bidRepository: Repository<GemBidData>,
        @InjectRepository(TenderActivity)
        private readonly activityRepository: Repository<TenderActivity>,
        @InjectRepository(UserBidInteraction)
        private readonly interactionRepository: Repository<UserBidInteraction>,
    ) { }

    async getKpis(userId: string): Promise<DashboardKpi> {
        const user = await this.customerRepository.findOne({
            where: { id: userId },
            relations: ['hsnCodes']
        });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        // 1. Calculate myTenders (Matching HSN Codes)
        const hsnCodes = user.hsnCodes.map(h => h.hsnCode);
        const myTendersCount = await this.bidRepository.count({
            where: hsnCodes.length > 0 ? { hsn: In(hsnCodes), isActive: true } : { isActive: true }
        });

        // Calculate date thresholds
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

        const nowIso = now.toISOString();
        const oneDayAgoIso = oneDayAgo.toISOString();
        const threeDaysFromNowIso = threeDaysFromNow.toISOString();

        // 2. Calculate todaysTenders (Matched and posted in last 24h)
        const todaysTendersCount = await this.bidRepository.count({
            where: hsnCodes.length > 0
                ? { hsn: In(hsnCodes), isActive: true, startDateRaw: MoreThanOrEqual(oneDayAgoIso) }
                : { isActive: true, startDateRaw: MoreThanOrEqual(oneDayAgoIso) }
        });

        // 3. Calculate expiringBids (Matched and expiring within 3 days)
        const expiringBidsCount = await this.bidRepository.count({
            where: hsnCodes.length > 0
                ? { hsn: In(hsnCodes), isActive: true, endDateRaw: LessThanOrEqual(threeDaysFromNowIso) }
                : { isActive: true, endDateRaw: LessThanOrEqual(threeDaysFromNowIso) }
        });

        // 4. Calculate docsReady and docsPending from UserBidInteraction
        // Assuming hasGeneratedBid means ready, and isAnalysed but not generated means pending
        const docsReadyCount = await this.interactionRepository.count({
            where: { customerId: userId, hasGeneratedBid: true }
        });
        const docsPendingCount = await this.interactionRepository.count({
            where: { customerId: userId, isAnalysed: true, hasGeneratedBid: false }
        });

        // 5. Calculate allTenders (Active tenders in the system)
        const allTendersCount = await this.bidRepository.count({
            where: { isActive: true }
        });

        // 3. Update or return the DashboardKpi record
        let kpi = await this.dashboardKpiRepository.findOne({
            where: { customerId: userId },
        });

        if (!kpi) {
            kpi = this.dashboardKpiRepository.create({ customerId: userId });
        }

        kpi.myTenders = myTendersCount;
        kpi.todaysTenders = todaysTendersCount;
        kpi.expiringBids = expiringBidsCount;
        kpi.docsReady = docsReadyCount;
        kpi.docsPending = docsPendingCount;
        kpi.allTenders = allTendersCount;

        return this.dashboardKpiRepository.save(kpi);
    }

    async getActivities(userId: string): Promise<TenderActivity[]> {
        return this.activityRepository.find({
            where: { customerId: userId, type: 'activity' },
            order: { date: 'DESC' },
            take: 10
        });
    }

    async getClosingSoon(userId: string): Promise<TenderActivity[]> {
        return this.activityRepository.find({
            where: { customerId: userId, type: 'closing_soon' },
            order: { date: 'ASC' },
            take: 10
        });
    }
}
