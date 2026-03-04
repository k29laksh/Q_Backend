import { Controller, Get, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { BidDataService, BidResult } from './bid-data.service';

@ApiTags('Bid Data')
@Controller('bid-data')
export class BidDataController {
  constructor(private readonly bidDataService: BidDataService) {}

  @Get('match/customer/:customerId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Find matching bids for a specific customer',
    description:
      'Fetches the configured HSN codes and keywords for a given customer ID from the database, then returns matching bid results sorted by relevance score.',
  })
  @ApiParam({
    name: 'customerId',
    description: 'The UUID of the customer to generate bids for',
  })
  @ApiResponse({
    status: 200,
    description: 'Matching bids returned successfully.',
  })
  @ApiResponse({
    status: 404,
    description: 'Customer not found or no HSN codes configured.',
  })
  async findBidsForCustomer(
    @Param('customerId') customerId: string,
  ): Promise<BidResult[]> {
    return this.bidDataService.findBidsForCustomer(customerId);
  }
}
