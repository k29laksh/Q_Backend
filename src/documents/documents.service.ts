import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyDocument, DocumentCategory } from '../entity/company-document.entity';
import { UploadDocumentDto } from './dto/upload-document.dto';

// Maps each category to its expected document types
const DOCUMENT_CONFIG: Record<DocumentCategory, string[]> = {
  [DocumentCategory.REGISTRATION_IDENTITY]: [
    'Company Incorporation Certificate',
    'PAN Card',
    'GST Registration Certificate',
    'MSME/Udyam Certificate',
  ],
  [DocumentCategory.FINANCIAL]: [
    'Income Tax Returns (ITR)',
    'Audited Balance Sheets',
    'Turnover Certificate',
    'Bank Statements',
  ],
  [DocumentCategory.WORK_EXPERIENCE]: [
    'Purchase Orders / Work Orders',
    'Client Completion Certificates',
    'Reference Letters',
    'Past Performance Reports',
  ],
  [DocumentCategory.CERTIFICATION]: [
    'ISO Certifications',
    'Industry Licenses',
    'Quality Certificates',
    'Safety Certifications',
  ],
};

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(CompanyDocument)
    private readonly documentRepo: Repository<CompanyDocument>,
  ) {}

  // Upload or replace a document
  async uploadDocument(
    companyId: string,
    dto: UploadDocumentDto,
    file: Express.Multer.File,
  ): Promise<CompanyDocument> {
    // Check if a document of this type already exists for the company
    let doc = await this.documentRepo.findOne({
      where: { companyId, documentType: dto.documentType },
    });

    if (doc) {
      // Replace existing
      doc.fileData = file.buffer;
      doc.fileName = file.originalname;
      doc.mimeType = file.mimetype;
      doc.status = 'UPLOADED';
    } else {
      // Create new
      doc = this.documentRepo.create({
        companyId,
        category: dto.category,
        documentType: dto.documentType,
        fileData: file.buffer,
        fileName: file.originalname,
        mimeType: file.mimetype,
        status: 'UPLOADED',
      });
    }

    return this.documentRepo.save(doc);
  }

  // Delete a document (revert to PENDING)
  async deleteDocument(companyId: string, documentId: string): Promise<void> {
    const doc = await this.documentRepo.findOne({
      where: { id: documentId, companyId },
    });
    if (!doc) throw new NotFoundException('Document not found');
    await this.documentRepo.remove(doc);
  }

  // Get repository status — all 16 slots with upload state
  async getRepositoryStatus(companyId: string) {
    const uploaded = await this.documentRepo.find({ where: { companyId } });

    const uploadedMap = new Map(uploaded.map((d) => [d.documentType, d]));

    const categories = Object.entries(DOCUMENT_CONFIG).map(([category, types]) => {
      const docs = types.map((type) => {
        const existing = uploadedMap.get(type);
        return {
          documentType: type,
          status: existing?.status ?? 'PENDING',
          id: existing?.id ?? null,
          fileName: existing?.fileName ?? null,
          uploadedAt: existing?.uploadedAt ?? null,
        };
      });

      const uploadedCount = docs.filter((d) => d.status === 'UPLOADED').length;

      return {
        category,
        uploadedCount,
        totalCount: types.length,
        documents: docs,
      };
    });

    const totalUploaded = uploaded.length;
    const totalSlots = 16;

    return {
      overallProgress: Math.round((totalUploaded / totalSlots) * 100),
      uploaded: totalUploaded,
      total: totalSlots,
      categories,
    };
  }

  // Stream/download a single document's file
  async getDocumentFile(companyId: string, documentId: string) {
    const doc = await this.documentRepo.findOne({
      where: { id: documentId, companyId },
    });
    if (!doc || !doc.fileData) throw new NotFoundException('File not found');
    return doc;
  }
}