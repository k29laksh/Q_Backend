import { Entity, Column, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from './base.entity'; // Adjust path if needed

// Enum to track the AI processing pipeline state
export enum HsnStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('qp_bid_data')
// MANAGER'S TIP: Composite index for blazing fast cursor pagination
@Index('idx_bid_hsn_status', ['hsnStatus', 'id'])
export class GemBidData extends BaseEntity {
  // Assuming BaseEntity doesn't already define id, otherwise remove this line
  @PrimaryGeneratedColumn()
  @Index({ unique: true })
  @Column({ type: 'varchar' })
  bidNumber: string;

  @Column({ type: 'text', nullable: true })
  bidUrl: string;

  @Column({ type: 'text', nullable: true })
  items: string;

  @Column({ type: 'text', nullable: true })
  ministryName: string;

  @Column({ type: 'text', nullable: true })
  organisationName: string;

  @Column({ type: 'text', nullable: true })
  departmentName: string;

  @Column({ type: 'varchar', nullable: true })
  startDateRaw: string;

  @Column({ type: 'varchar', nullable: true })
  endDateRaw: string;

  @Column({ type: 'integer', nullable: true })
  quantity: number;

  @Column({ type: 'varchar', nullable: true })
  hsn: string;

  @Column({ type: 'integer', nullable: true })
  scrapingPortalId: number;

  @Column({ type: 'boolean', nullable: true, default: true })
  isActive: boolean;

  // New column for tracking HSN generation status
  @Column({
    type: 'enum',
    enum: HsnStatus,
    default: HsnStatus.PENDING,
  })
  hsnStatus: HsnStatus;
}
