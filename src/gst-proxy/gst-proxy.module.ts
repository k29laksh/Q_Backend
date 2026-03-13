import { Module } from '@nestjs/common';
import { GstProxyController } from './gst-proxy.controller';
import { GstProxyService } from './gst-proxy.service';

@Module({
  controllers: [GstProxyController],
  providers: [GstProxyService],
  exports: [GstProxyService],
})
export class GstProxyModule {}
