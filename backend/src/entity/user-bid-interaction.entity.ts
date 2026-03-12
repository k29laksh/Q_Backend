import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Unique } from 'typeorm';
import { Customer } from './customer.entity';
import { GemBidData } from './bid-data.entity';

@Entity('user_bid_interactions')
@Unique(['customerId', 'bidId'])
export class UserBidInteraction {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @ManyToOne(() => Customer)
    customer: Customer;

    @Column()
    customerId: string;

    @ManyToOne(() => GemBidData)
    bid: GemBidData;

    @Column()
    bidId: number;

    @Column({ default: false })
    isSaved: boolean;

    @Column({ default: false })
    isAnalysed: boolean;

    @Column({ default: false })
    hasGeneratedBid: boolean;
}
