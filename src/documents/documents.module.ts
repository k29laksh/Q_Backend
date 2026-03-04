import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CompanyDocument } from '../entity/company-document.entity';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [TypeOrmModule.forFeature([CompanyDocument])],
  controllers: [DocumentsController],
  providers: [DocumentsService],
  exports: [DocumentsService], // export if other modules need progress data
})
export class DocumentsModule {}