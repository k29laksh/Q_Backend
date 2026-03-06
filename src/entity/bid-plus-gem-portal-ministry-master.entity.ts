import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { BidPlusGemPortalOrganizationMaster } from './bid-plus-gem-portal-organization-master.entity';

@Entity('qp_bid_plus_gem_portal_ministry_master')
export class BidPlusGemPortalMinistryMaster extends BaseEntity {
  @Column({ type: 'varchar' })
  ministryName: string;

  @OneToMany(
    () => BidPlusGemPortalOrganizationMaster,
    (org) => org.bidPlusGemPortalMinistryMaster,
  )
  bidPlusGemPortalOrganizationMasters: BidPlusGemPortalOrganizationMaster[];
}
