import { Controller, Get, Post, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { DashboardKpiDto } from '../dtos/dashboard.dto';
import { SeedService } from './seed.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(AccessTokenGuard)
export class DashboardController {
    constructor(
        private readonly dashboardService: DashboardService,
        private readonly seedService: SeedService,
    ) { }

    @Get('kpis')
    @ApiOperation({ summary: 'Get dashboard KPIs for the authenticated user' })
    @ApiResponse({ status: 200, description: 'KPIs retrieved successfully', type: DashboardKpiDto })
    async getKpis(@Req() req): Promise<DashboardKpiDto> {
        const userId = req.user.userId;
        return this.dashboardService.getKpis(userId);
    }

    @Get('activities')
    @ApiOperation({ summary: 'Get recent tender activities for the authenticated user' })
    async getActivities(@Req() req) {
        const userId = req.user.userId;
        return this.dashboardService.getActivities(userId);
    }

    @Get('closing-soon')
    @ApiOperation({ summary: 'Get tenders closing soon for the authenticated user' })
    async getClosingSoon(@Req() req) {
        const userId = req.user.userId;
        return this.dashboardService.getClosingSoon(userId);
    }

    @Post('seed')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Seed 50 records for testing (KPIs will be calculated from this data)' })
    async seed(@Req() req) {
        const userId = req.user.userId;
        return this.seedService.seedData(userId);
    }
}
