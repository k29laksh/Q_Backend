import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import {
  BidDataService,
  BidResult,
  PaginatedTenders,
} from './bid-data.service';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { AwsS3Service } from '../aws-s3/aws-s3.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../entity/company.entity';
import { CompanyDocument } from '../entity/company-document.entity';
import { GemBidData } from '../entity/bid-data.entity';

@ApiTags('Bid Data')
@Controller('bid-data')
@UseGuards(AccessTokenGuard)
@ApiBearerAuth()
export class BidDataController {
  private readonly logger = new Logger(BidDataController.name);

  constructor(
    private readonly bidDataService: BidDataService,
    private readonly rabbitmqService: RabbitmqService,
    private readonly awsS3Service: AwsS3Service,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
    @InjectRepository(CompanyDocument)
    private readonly companyDocumentRepo: Repository<CompanyDocument>,
    @InjectRepository(GemBidData)
    private readonly bidDataRepo: Repository<GemBidData>,
  ) { }

  @Get('tenders')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all tenders (paginated)',
    description: 'Returns all active tenders from the database with pagination. No matching logic — raw full list.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'All tenders returned successfully.' })
  async getAllTenders(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<PaginatedTenders> {
    return this.bidDataService.getAllTenders(page, limit);
  }

  @Get('match/customer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Find matching bids for the authenticated customer',
    description:
      'Fetches the configured HSN codes and keywords for the logged-in user from the database, then returns matching bid results sorted by relevance score.',
  })
  @ApiResponse({
    status: 200,
    description: 'Matching bids returned successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found or no HSN codes configured.',
  })
  async findBidsForCustomer(@Req() req: any): Promise<BidResult[]> {
    const customerId = req.user.userId;
    return this.bidDataService.findBidsForCustomer(customerId);
  }

  @Post('apply/:bidId')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Apply for a tender',
    description:
      'Fetches the bid/tender details by ID and the company documents for the logged-in customer, then publishes both the bid URL and documents to RabbitMQ for the AI service to process.',
  })
  @ApiResponse({ status: 202, description: 'Tender application queued.' })
  @ApiResponse({ status: 404, description: 'Bid or company not found.' })
  async applyForTender(
    @Param('bidId', ParseIntPipe) bidId: number,
    @Req() req: any,
  ) {
    const userId: string = req.user.userId;

    // 1. Fetch the bid/tender details
    const bid = await this.bidDataRepo.findOne({ where: { id: bidId } });
    if (!bid) {
      throw new NotFoundException(`Bid with ID ${bidId} not found.`);
    }

    // 2. Look up the company mapped to this customer
    const company = await this.companyRepo.findOne({ where: { userId } });
    if (!company) {
      throw new NotFoundException('No company found for this customer.');
    }

    // 3. Fetch all uploaded documents for this company
    const documents = await this.companyDocumentRepo.find({
      where: { companyId: company.id, status: 'UPLOADED' },
    });

    // 4. Build the payload with bid details and company documents
    const companyDocuments = documents.map((doc) => ({
      id: doc.id,
      category: doc.category,
      documentType: doc.documentType,
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
    }));

    const bidDetails = {
      id: bid.id,
      bidNumber: bid.bidNumber,
      items: bid.items,
      ministryName: bid.ministryName,
      organisationName: bid.organisationName,
      departmentName: bid.departmentName,
      startDate: bid.startDateRaw,
      endDate: bid.endDateRaw,
      quantity: bid.quantity,
      hsn: bid.hsn,
    };

    // 5. Download the bid document from GeM portal and re-upload to S3
    //    so that the Python AI service can reliably access it.
    //    (GeM gov portal blocks direct server-to-server downloads)
    const originalBidUrl = bid.bidUrl || '';
    let s3BidUrl = originalBidUrl;
    if (originalBidUrl && originalBidUrl.startsWith('http')) {
      const safeBidNumber = bid.bidNumber.replace(/\//g, '_');
      this.logger.log(
        `Proxying bid document to S3 for ${bid.bidNumber}: ${originalBidUrl}`,
      );
      try {
        const { url } = await this.awsS3Service.downloadAndUploadToS3(
          originalBidUrl,
          `bid-documents/${safeBidNumber}`,
          `${safeBidNumber}.pdf`,
        );
        s3BidUrl = url;
        this.logger.log(
          `Bid document proxied to S3: ${url}`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to proxy bid document to S3 for ${bid.bidNumber}`,
          err instanceof Error ? err.stack : err,
        );
      }
    }

    // 6. Publish to RabbitMQ (fire-and-forget — client uses SSE to get results)
    await this.rabbitmqService.publishTenderApply({
      bidUrl: s3BidUrl,
      bidNumber: bid.bidNumber,
      bidDetails,
      companyDocuments,
    });

    return {
      status: 'processing',
      bidNumber: bid.bidNumber,
      bidUrl: s3BidUrl,
      documentsIncluded: companyDocuments.length,
    };
  }
}
