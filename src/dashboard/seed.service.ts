import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { faker } from '@faker-js/faker';
import { GemBidData } from '../entity/bid-data.entity';
import { TenderActivity } from '../entity/tender-activity.entity';
import { UserBidInteraction } from '../entity/user-bid-interaction.entity';
import { Customer } from '../entity/customer.entity';
import { CustomerHsn } from '../entity/customer-hsn-codes.entity';

@Injectable()
export class SeedService {
    constructor(
        @InjectRepository(GemBidData)
        private readonly bidRepo: Repository<GemBidData>,
        @InjectRepository(TenderActivity)
        private readonly activityRepo: Repository<TenderActivity>,
        @InjectRepository(UserBidInteraction)
        private readonly interactionRepo: Repository<UserBidInteraction>,
        @InjectRepository(Customer)
        private readonly customerRepo: Repository<Customer>,
        @InjectRepository(CustomerHsn)
        private readonly hsnRepo: Repository<CustomerHsn>,
    ) { }

    async seedData(userId: string) {
        const customer = await this.customerRepo.findOne({
            where: { id: userId },
            relations: ['hsnCodes']
        });
        if (!customer) throw new Error('Customer not found for seeding');

        let userHsnCodes = customer.hsnCodes.map(h => h.hsnCode);

        // Guarantee user has HSN codes so "My Tenders" calculation works
        if (userHsnCodes.length === 0) {
            const fakeHsn1 = this.hsnRepo.create({
                hsnCode: faker.string.numeric(8),
                keywords: ['fake-keyword-1'],
                customerId: userId,
            });
            const fakeHsn2 = this.hsnRepo.create({
                hsnCode: faker.string.numeric(8),
                keywords: ['fake-keyword-2'],
                customerId: userId,
            });
            await this.hsnRepo.save([fakeHsn1, fakeHsn2]);
            userHsnCodes = [fakeHsn1.hsnCode, fakeHsn2.hsnCode];
        }

        // 1. Seed 50 GemBidData records
        const bids: GemBidData[] = [];
        const now = new Date();
        for (let i = 0; i < 50; i++) {
            let startDate = faker.date.recent();
            let endDate = faker.date.future();

            // First 10 records: Force startDate to be within the last 12 hours (Today's Tenders)
            if (i < 10) {
                startDate = new Date(now.getTime() - 12 * 60 * 60 * 1000);
            }
            // Next 10 records: Force endDate to be within the next 48 hours (Expiring Bids)
            if (i >= 10 && i < 20) {
                endDate = new Date(now.getTime() + 48 * 60 * 60 * 1000);
            }

            const bid = this.bidRepo.create({
                bidNumber: `GEM/${now.getFullYear()}/${faker.string.alphanumeric(6).toUpperCase()}`,
                bidUrl: faker.internet.url(),
                items: faker.commerce.productName(),
                ministryName: faker.company.name() + ' Ministry',
                organisationName: faker.company.name(),
                departmentName: faker.commerce.department(),
                startDateRaw: startDate.toISOString(),
                endDateRaw: endDate.toISOString(),
                quantity: faker.number.int({ min: 1, max: 1000 }),
                isActive: true,
                // Assign user's HSN to 40% of bids so they show up in "My Tenders"
                hsn: i % 2 === 0
                    ? faker.helpers.arrayElement(userHsnCodes)
                    : faker.string.numeric(8),
            });
            bids.push(bid);
        }
        await this.bidRepo.save(bids);

        // 2. Seed User Interactions for the current user
        const savedBids = bids.slice(0, 5).map(bid => this.interactionRepo.create({
            customerId: userId,
            bidId: bid.id,
            isSaved: true,
        }));
        const analysedBids = bids.slice(5, 10).map(bid => this.interactionRepo.create({
            customerId: userId,
            bidId: bid.id,
            isAnalysed: true,
        }));
        const generatedBids = bids.slice(10, 13).map(bid => this.interactionRepo.create({
            customerId: userId,
            bidId: bid.id,
            hasGeneratedBid: true,
        }));

        await this.interactionRepo.save([...savedBids, ...analysedBids, ...generatedBids]);

        // 3. Seed Tender Activities (Recent Activity)
        const activities = Array.from({ length: 10 }).map(() => this.activityRepo.create({
            customerId: userId,
            type: 'activity',
            title: faker.company.name(),
            description: `Bidding process for ${faker.commerce.productName()} is in progress.`,
            amount: parseFloat(faker.commerce.price({ min: 10000, max: 500000 })),
            status: faker.helpers.arrayElement(['In Progress', 'Completed', 'Draft']),
            date: faker.date.recent(),
        }));

        // 4. Seed Closing Soon Tenders
        const closingSoon = Array.from({ length: 5 }).map(() => this.activityRepo.create({
            customerId: userId,
            type: 'closing_soon',
            title: faker.commerce.productName(),
            description: faker.company.name(),
            amount: parseFloat(faker.commerce.price({ min: 5000, max: 200000 })),
            date: faker.date.soon({ days: 7 }),
        }));

        await this.activityRepo.save([...activities, ...closingSoon]);

        return { message: 'Seed completed: 50 bids, 13 interactions, 15 activities created.' };
    }
}