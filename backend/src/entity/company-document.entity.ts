import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { Company } from './company.entity';

export enum DocumentCategory {
  REGISTRATION_IDENTITY = 'REGISTRATION_IDENTITY',
  FINANCIAL = 'FINANCIAL',
  WORK_EXPERIENCE = 'WORK_EXPERIENCE',
  CERTIFICATION = 'CERTIFICATION',
}

@Entity('company_documents')
export class CompanyDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: DocumentCategory })
  category: DocumentCategory;

  @Column()
  documentType: string;

  @Column({ nullable: true })
  fileName: string;

  @Column({ nullable: true })
  fileUrl: string;

  @Column({ default: 'PENDING' })
  status: string;

  @ManyToOne(() => Company, (company) => company.documents, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column()
  companyId: string;

  @CreateDateColumn()
  uploadedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
