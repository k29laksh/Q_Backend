import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SignupStep1Dto {
  @ApiProperty({ example: 'John Doe', description: 'Full name of the user' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;
}

export class SignupStep2Dto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'ABCDE1234F', description: 'PAN number in format ABCDE1234F' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, {
    message: 'PAN must be in format: ABCDE1234F',
  })
  pan: string;

  @ApiProperty({ example: 'Acme Pvt Ltd', description: 'Legal name of the company' })
  @IsString()
  @IsNotEmpty()
  legalName: string;

  @ApiPropertyOptional({ example: '27AABCU9603R1ZM', description: 'GSTIN number' })
  @IsString()
  @IsOptional()
  gstin?: string;

  @ApiPropertyOptional({ example: '123 Main St, Mumbai', description: 'Business address' })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiPropertyOptional({ example: '2010', description: 'Year of establishment' })
  @IsString()
  @IsOptional()
  establishmentYear?: string;

  @ApiPropertyOptional({ example: 'Jane Doe', description: 'Name of the business owner' })
  @IsString()
  @IsOptional()
  ownerName?: string;
}

export class SendOtpDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be 6 digits' })
  otp: string;
}
