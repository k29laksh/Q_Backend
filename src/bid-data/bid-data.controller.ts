import {
  Controller,
  Get,
  Post,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
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

@ApiTags('Bid Data')
@Controller('bid-data')
@UseGuards(AccessTokenGuard)
@ApiBearerAuth()
export class BidDataController {
  constructor(
    private readonly bidDataService: BidDataService,
    private readonly rabbitmqService: RabbitmqService,
  ) {}

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

  @Post('analysis')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Trigger AI analysis for the authenticated customer',
    description:
      'Publishes the customer ID to the analysis_exchange on RabbitMQ. The FastAPI AI service picks it up and runs the analysis.',
  })
  @ApiResponse({ status: 202, description: 'Analysis request queued.' })
  async triggerAnalysis(@Req() req: any) {
    const userId: string = req.user.userId;
    await this.rabbitmqService.publishAnalysis(userId);
    return {
      status: 'queued',
      message: 'Analysis request sent to AI service.',
      userId,
    };
  }
}
