import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { BidDataService, BidResult } from './bid-data.service';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';

@ApiTags('Bid Data')
@Controller('bid-data')
@UseGuards(AccessTokenGuard)
@ApiBearerAuth()
export class BidDataController {
  constructor(private readonly bidDataService: BidDataService) {}

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
}
