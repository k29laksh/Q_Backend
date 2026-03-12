import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Customer } from './customer.entity';

@Entity('tender_activities')
export class TenderActivity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'enum', enum: ['activity', 'closing_soon'] })
    type: 'activity' | 'closing_soon';

    @Column()
    title: string;

    @Column({ nullable: true })
    description: string;

    @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
    amount: number;

    @Column({ nullable: true })
    status: string; // e.g., 'In Progress', 'Completed', 'Closed'

    @Column({ type: 'timestamp', nullable: true })
    date: Date;

    @ManyToOne(() => Customer, (customer) => customer.tenderActivities)
    customer: Customer;

    @Column()
    customerId: string;

    @CreateDateColumn()
    createdAt: Date;
}
