// src/profile/customer-profile.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../entity/customer.entity';
import { Company } from '../entity/company.entity';
import { CustomerHsn } from '../entity/customer-hsn-codes.entity';
import {
  CreateMultipleCompaniesDto,
  SaveHsnSetupDto,
} from '../dtos/profile.dto';

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

    const savedCompanies: Company[] = [];

    for (const companyData of dto.companies) {
      // 1. If GSTIN is provided, check if it already exists in the entire database
      if (companyData.gstin) {
        const existingGstCompany = await this.companyRepo.findOne({
          where: { gstin: companyData.gstin },
        });

        if (existingGstCompany) {
          // If it belongs to the SAME user, just update it (prevents crashes if they click Continue twice)
          if (existingGstCompany.userId === customer.id) {
            Object.assign(existingGstCompany, companyData);
            savedCompanies.push(
              await this.companyRepo.save(existingGstCompany),
            );
            continue; // Move to the next company in the loop
          } else {
            // If it belongs to SOMEONE ELSE, throw the error
            throw new ConflictException(
              `A company already exists with this GST number: ${companyData.gstin}`,
            );
          }
        }
      } else {
        // 2. If NO GSTIN is provided, check if they already added this exact PAN + Name
        const existingPanCompany = await this.companyRepo.findOne({
          where: {
            pan: companyData.pan,
            legalName: companyData.legalName,
            userId: customer.id,
          },
        });

        if (existingPanCompany) {
          Object.assign(existingPanCompany, companyData);
          savedCompanies.push(await this.companyRepo.save(existingPanCompany));
          continue;
        }
      }

      // 3. If it does not exist, create a brand new company record
      const newCompany = this.companyRepo.create({
        ...companyData,
        customer: customer,
        userId: customer.id,
      });

      savedCompanies.push(await this.companyRepo.save(newCompany));
    }

    return savedCompanies;
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
  // 3. Update Get Profile API to fetch all relationship details (Safely fetching documents)
  async getCustomerProfile(customerId: string) {
    const profile = await this.customerRepo
      .createQueryBuilder('customer')
      // 1. Join and select all company data
      .leftJoinAndSelect('customer.companies', 'company')
      // 2. Join and select all HSN codes
      .leftJoinAndSelect('customer.hsnCodes', 'hsn')
      // 3. Join the documents, but use 'leftJoin' instead of 'leftJoinAndSelect'
      // so we can manually pick which columns to download
      .leftJoin('company.documents', 'document')
      // Explicitly select only the lightweight metadata (skipping the 'fileData' buffer!)
      .addSelect([
        'document.id',
        'document.category',
        'document.documentType',
        'document.fileName',
        'document.status',
        'document.uploadedAt',
      ])
      .where('customer.id = :customerId', { customerId })
      .getOne();

    if (!profile) {
      throw new NotFoundException('Customer profile not found');
    }

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
