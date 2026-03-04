import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Customer } from './customer.entity';
import { CompanyDocument } from './company-document.entity';

@Entity('companies')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  legalName: string;

  @Column()
  pan: string;

  @Column({ unique: true })
  gstin: string;

  @Column()
  address: string;

  @Column({ nullable: true })
  establishmentYear: string;

  // Changed to ManyToOne: Many companies can belong to one customer
  @ManyToOne(() => Customer, (customer) => customer.companies, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  customer: Customer;

  @Column()
  userId: string;

  @Column({
    type: 'enum',
    enum: ['ACTIVE', 'PENDING', 'REJECTED'],
    default: 'PENDING',
  })
  status: string;

  // Documents stay with the company (PAN, GST Cert, ITRs belong to the business)
  @OneToMany(() => CompanyDocument, (doc) => doc.company, { cascade: true })
  documents: CompanyDocument[];

  @CreateDateColumn()
  createdAt: Date;
}
