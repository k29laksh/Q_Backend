// src/profile/dto/profile.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CompanyDetailDto {
  @IsString() @IsNotEmpty() pan: string;
  @IsString() @IsNotEmpty() legalName: string;
  @IsString() @IsOptional() gstin?: string;
  @IsString() @IsOptional() address?: string;
  @IsString() @IsOptional() establishmentYear?: string;
}

export class CreateMultipleCompaniesDto {
  @IsArray()
  @ApiProperty({ type: [CompanyDetailDto] })
  companies: CompanyDetailDto[];
}

export class HsnDetailDto {
  @IsString()
  @IsNotEmpty()
  hsnCode: string;

  // Validates that keywords is an array, and every item inside is a string
  @IsArray()
  @IsString({ each: true })
  keywords: string[];
}

export class SaveHsnSetupDto {
  @IsArray()
  @ApiProperty({ type: [HsnDetailDto] })
  hsns: HsnDetailDto[];

  @IsBoolean() @IsOptional() emailAlerts?: boolean;
  @IsBoolean() @IsOptional() whatsappAlerts?: boolean;
}

export class UpdateProfileDto {
  @IsString() @IsOptional() fullName?: string;
  @IsString() @IsOptional() mobile?: string;
  @IsString() @IsOptional() companyLegalName?: string;
  @IsString() @IsOptional() companyAddress?: string;
  @IsString() @IsOptional() establishmentYear?: string;
}
