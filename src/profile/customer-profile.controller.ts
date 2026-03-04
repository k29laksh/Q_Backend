// src/profile/customer-profile.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Delete,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CustomerProfileService } from './customer-profile.service';
import {
  CreateMultipleCompaniesDto,
  SaveHsnSetupDto,
} from 'src/dtos/profile.dto';

@ApiTags('Customer Profile')
@Controller('profile')
export class CustomerProfileController {
  constructor(private readonly profileService: CustomerProfileService) {}

  @Post(':customerId/companies')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Save multiple companies from PAN verification step',
  })
  async addCompanies(
    @Param('customerId') customerId: string,
    @Body() dto: CreateMultipleCompaniesDto,
  ) {
    return this.profileService.addMultipleCompanies(customerId, dto);
  }

  @Post(':customerId/hsn-setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Save multiple HSN keywords and Notification Preferences',
  })
  async saveHsnSetup(
    @Param('customerId') customerId: string,
    @Body() dto: SaveHsnSetupDto,
  ) {
    return this.profileService.saveHsnSetup(customerId, dto);
  }

  @Get('customer/:customerId')
  @ApiOperation({
    summary: 'Get full customer profile including HSNs and Companies',
  })
  async getProfile(@Param('customerId') customerId: string) {
    return this.profileService.getCustomerProfile(customerId);
  }

  @Get('company/:companyId')
  @ApiOperation({ summary: 'Get specific company details including Documents' })
  async getCompanyDetails(@Param('companyId') companyId: string) {
    return this.profileService.getCompanyDetails(companyId);
  }

  @Post(':customerId/hsn-append')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add new HSNs to the profile without deleting existing ones',
  })
  async appendHsns(
    @Param('customerId') customerId: string,
    @Body() dto: SaveHsnSetupDto,
  ) {
    return this.profileService.appendHsns(customerId, dto);
  }

  @Delete('hsn/:hsnId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a single HSN row' })
  async removeHsn(@Param('hsnId') hsnId: string) {
    return this.profileService.removeHsn(hsnId);
  }
}
