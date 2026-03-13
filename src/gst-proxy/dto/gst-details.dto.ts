import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GstDetailsDto {
  @ApiProperty({ example: '27AABCU9603R1ZM' })
  @IsString()
  @IsNotEmpty()
  gstNumber: string;

  @ApiProperty({ example: 'Y', required: false })
  @IsString()
  @IsOptional()
  consent?: string;
}

export class GstDetailsAdvanceDto {
  @ApiProperty({ example: '27AABCU9603R1ZM' })
  @IsString()
  @IsNotEmpty()
  gstNumber: string;

  @ApiProperty({ example: true, required: false })
  @IsBoolean()
  @IsOptional()
  hsnDetails?: boolean;

  @ApiProperty({ example: 'Y', required: false })
  @IsString()
  @IsOptional()
  consent?: string;
}
