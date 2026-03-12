import { Entity, Column, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { BidPlusGemPortalMinistryMaster } from './bid-plus-gem-portal-ministry-master.entity';

@Entity('qp_bid_plus_gem_portal_organization_master')
export class BidPlusGemPortalOrganizationMaster extends BaseEntity {
  @Column({ type: 'varchar' })
  organizationName: string;

  @ManyToOne(() => BidPlusGemPortalMinistryMaster, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn()
  bidPlusGemPortalMinistryMaster: BidPlusGemPortalMinistryMaster;
}
