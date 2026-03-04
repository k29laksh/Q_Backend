import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  IsBoolean,
} from 'class-validator';

export class CreateBidDataDto {
  @IsNotEmpty()
  @IsString()
  bidNumber: string;

  @IsOptional()
  @IsString()
  bidUrl: string;

  @IsOptional()
  @IsString()
  items: string;

  @IsOptional()
  @IsString()
  ministryName: string;

  @IsOptional()
  @IsString()
  organisationName: string;

  @IsOptional()
  @IsString()
  departmentName: string;

  @IsOptional()
  @IsString()
  startDateRaw: string;

  @IsOptional()
  @IsString()
  endDateRaw: string;

  @IsOptional()
  @IsInt()
  quantity: number;

  @IsOptional()
  @IsString()
  hsn: string;

  @IsOptional()
  @IsInt()
  scrapingPortalId: number;

  @IsOptional()
  @IsBoolean()
  isActive: boolean;
}
