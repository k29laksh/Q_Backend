import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
} from 'typeorm';
import { Customer } from './customer.entity';

@Entity('customer_hsn_codes')
export class CustomerHsn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  hsnCode: string;

  // Changed to an array of strings to hold multiple keywords
  @Column({ type: 'simple-array' })
  keywords: string[];

  @ManyToOne(() => Customer, (customer) => customer.hsnCodes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'customerId' })
  customer: Customer;

  @Column()
  customerId: string;

  @CreateDateColumn()
  createdAt: Date;
}
