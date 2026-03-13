import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { GstProxyService } from './gst-proxy.service';
import { PanToGstDto } from './dto/pan-to-gst.dto';
import { GstDetailsDto, GstDetailsAdvanceDto } from './dto/gst-details.dto';

@ApiTags('GST Proxy')
@Controller('api')
export class GstProxyController {
  constructor(private readonly gstProxyService: GstProxyService) {}

  @Post('pan-to-gst')
  @ApiOperation({ summary: 'Fetch GST numbers linked to a PAN' })
  panToGst(@Body() dto: PanToGstDto) {
    return this.gstProxyService.panToGst(dto.pan, dto.consent);
  }

  @Post('get-gst-details')
  @ApiOperation({ summary: 'Fetch basic company details for a GST number' })
  getGstDetails(@Body() dto: GstDetailsDto) {
    return this.gstProxyService.getGstDetails(dto.gstNumber, dto.consent);
  }

  @Post('get-gst-details-advance')
  @ApiOperation({ summary: 'Fetch advanced GST details including HSN codes' })
  getGstDetailsAdvance(@Body() dto: GstDetailsAdvanceDto) {
    return this.gstProxyService.getGstDetailsAdvance(
      dto.gstNumber,
      dto.hsnDetails,
      dto.consent,
    );
  }
}
