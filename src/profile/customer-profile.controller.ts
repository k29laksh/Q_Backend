// src/profile/customer-profile.controller.ts
import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomerProfileService } from './customer-profile.service';
import {
  CreateMultipleCompaniesDto,
  SaveHsnSetupDto,
  UpdateProfileDto,
} from '../dtos/profile.dto';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';

@ApiTags('Customer Profile')
@Controller('profile')
@UseGuards(AccessTokenGuard)
@ApiBearerAuth()
export class CustomerProfileController {
  constructor(private readonly profileService: CustomerProfileService) {}

  @Post('companies')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Save multiple companies from PAN verification step',
  })
  async addCompanies(@Req() req: any, @Body() dto: CreateMultipleCompaniesDto) {
    const customerId = req.user.userId;
    return this.profileService.addMultipleCompanies(customerId, dto);
  }

  @Post('hsn-setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Save multiple HSN keywords and Notification Preferences',
  })
  async saveHsnSetup(@Req() req: any, @Body() dto: SaveHsnSetupDto) {
    const customerId = req.user.userId;
    return this.profileService.saveHsnSetup(customerId, dto);
  }

  @Get('customer')
  @ApiOperation({
    summary: 'Get full customer profile including HSNs and Companies',
  })
  async getProfile(@Req() req: any) {
    const customerId = req.user.userId;
    return this.profileService.getCustomerProfile(customerId);
  }

  @Patch('customer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update customer profile and company info' })
  async updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    const customerId = req.user.userId;
    return this.profileService.updateProfile(customerId, dto);
  }

  @Get('company/:companyId')
  @ApiOperation({ summary: 'Get specific company details including Documents' })
  async getCompanyDetails(@Param('companyId') companyId: string) {
    return this.profileService.getCompanyDetails(companyId);
  }

  @Post('hsn-append')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add new HSNs to the profile without deleting existing ones',
  })
  async appendHsns(@Req() req: any, @Body() dto: SaveHsnSetupDto) {
    const customerId = req.user.userId;
    return this.profileService.appendHsns(customerId, dto);
  }

  @Delete('hsn/:hsnId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a single HSN row' })
  async removeHsn(@Param('hsnId') hsnId: string) {
    return this.profileService.removeHsn(hsnId);
  }
}
