import { Entity, Column, PrimaryGeneratedColumn, OneToOne, JoinColumn } from 'typeorm';
import { Customer } from './customer.entity';

@Entity('dashboard_kpis')
export class DashboardKpi {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ default: 0 })
    myTenders: number;

    @Column({ default: 0 })
    todaysTenders: number;

    @Column({ default: 0 })
    expiringBids: number;

    @Column({ default: 0 })
    docsReady: number;

    @Column({ default: 0 })
    docsPending: number;

    @Column({ default: 0 })
    allTenders: number;

    @OneToOne(() => Customer, (customer) => customer.dashboardKpi, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'customerId' })
    customer: Customer;

    @Column()
    customerId: string;
}
