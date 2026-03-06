import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Company } from './company.entity';
import { CustomerHsn } from './customer-hsn-codes.entity';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fullName: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  mobile: string;

  @Column({ nullable: true, type: 'text' })
  hashedRefreshToken: string | null;

  @Column({ default: true })
  emailAlerts: boolean;

  @Column({ default: true })
  whatsappAlerts: boolean;

  // Changed to OneToMany: A customer can have multiple companies
  @OneToMany(() => Company, (company) => company.customer, { cascade: true })
  companies: Company[];

  // Moved HSN codes to Customer as requested
  @OneToMany(() => CustomerHsn, (hsn) => hsn.customer, { cascade: true })
  hsnCodes: CustomerHsn[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
