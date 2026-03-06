import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
@Entity('qp_bid_data')
export class GemBidData extends BaseEntity {
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
}
