// src/profile/customer-profile.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../entity/customer.entity';
import { Company } from '../entity/company.entity';
import { CustomerHsn } from 'src/entity/customer-hsn-codes.entity';
import {
  CreateMultipleCompaniesDto,
  SaveHsnSetupDto,
} from 'src/dtos/profile.dto';

@Injectable()
export class CustomerProfileService {
  constructor(
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
    @InjectRepository(Company) private companyRepo: Repository<Company>,
    @InjectRepository(CustomerHsn) private hsnRepo: Repository<CustomerHsn>,
  ) {}

  // 1. API to bulk save multiple companies from the Verification Step
  async addMultipleCompanies(
    customerId: string,
    dto: CreateMultipleCompaniesDto,
  ) {
    const customer = await this.customerRepo.findOne({
      where: { id: customerId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const companiesToSave = dto.companies.map((companyData) => {
      return this.companyRepo.create({
        ...companyData,
        customer: customer, // Link to the customer
        userId: customer.id,
      });
    });

    return this.companyRepo.save(companiesToSave);
  }

  // 2. API to save multiple HSN codes and Notification Preferences
  // API to save multiple HSN codes and Notification Preferences (Replace All)
  async saveHsnSetup(customerId: string, dto: SaveHsnSetupDto) {
    const customer = await this.customerRepo.findOne({
      where: { id: customerId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    if (dto.emailAlerts !== undefined) customer.emailAlerts = dto.emailAlerts;
    if (dto.whatsappAlerts !== undefined)
      customer.whatsappAlerts = dto.whatsappAlerts;
    await this.customerRepo.save(customer);

    // Clear old HSNs
    await this.hsnRepo.delete({ customerId: customer.id });

    // Save the new array of HSNs with multiple keywords
    const hsnsToSave = dto.hsns.map((hsn) => {
      return this.hsnRepo.create({
        hsnCode: hsn.hsnCode,
        keywords: hsn.keywords, // Now passing the full array directly
        customer: customer,
        customerId: customer.id,
      });
    });

    return this.hsnRepo.save(hsnsToSave);
  }

  // API to APPEND new HSNs (Does not delete old ones)
  async appendHsns(customerId: string, dto: SaveHsnSetupDto) {
    const customer = await this.customerRepo.findOne({
      where: { id: customerId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const newHsns = dto.hsns.map((hsn) => {
      return this.hsnRepo.create({
        hsnCode: hsn.hsnCode,
        keywords: hsn.keywords, // Now passing the full array directly
        customer: customer,
        customerId: customer.id,
      });
    });

    return this.hsnRepo.save(newHsns);
  }
  // 3. Update Get Profile API to fetch all relationship details
  async getCustomerProfile(customerId: string) {
    const profile = await this.customerRepo.findOne({
      where: { id: customerId },
      relations: ['companies', 'hsnCodes'], // Fetches the nested data
    });

    if (!profile) throw new NotFoundException('Customer profile not found');
    return profile;
  }

  // 4. Make an API to get company details (fetching document relations)
  async getCompanyDetails(companyId: string) {
    const company = await this.companyRepo.findOne({
      where: { id: companyId },
      relations: ['documents'], // Fetches the nested PDFs/Documents
    });

    if (!company) throw new NotFoundException('Company not found');
    return company;
  }

  // API to delete a single HSN row when the user clicks the trash icon
  async removeHsn(hsnId: string) {
    const result = await this.hsnRepo.delete(hsnId);
    if (result.affected === 0) {
      throw new NotFoundException(`HSN with ID ${hsnId} not found`);
    }
    return { message: 'HSN successfully deleted' };
  }
}
