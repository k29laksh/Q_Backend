import { ApiProperty } from '@nestjs/swagger';

export class DashboardKpiDto {
    @ApiProperty({ example: 'uuid-string', description: 'The unique identifier of the KPI record' })
    id: string;

    @ApiProperty({ example: 47, description: 'Number of tenders matched' })
    myTenders: number;

    @ApiProperty({ example: 12, description: "Number of matched tenders posted today (in the last 24h)" })
    todaysTenders: number;

    @ApiProperty({ example: 5, description: 'Number of matched tenders expiring soon (within 3 days)' })
    expiringBids: number;

    @ApiProperty({ example: 24, description: 'Number of generated bid documents ready for submission' })
    docsReady: number;

    @ApiProperty({ example: 8, description: 'Number of bid documents pending generation or review' })
    docsPending: number;

    @ApiProperty({ example: 287, description: 'Total number of active tenders available in the system' })
    allTenders: number;

    @ApiProperty({ example: 'uuid-string', description: 'The unique identifier of the customer' })
    customerId: string;
}
