import { IsString, IsNotEmpty } from 'class-validator';

export class CreateBidPlusGemPortalMinistryMasterDto {
  @IsNotEmpty()
  @IsString()
  ministryName: string;
}
