import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';

export class CreateBidPlusGemPortalOrganizationMasterDto {
  @IsNotEmpty()
  @IsString()
  organizationName: string;

  @IsOptional()
  @IsInt()
  bidPlusGemPortalMinistryMasterId: number;
}
