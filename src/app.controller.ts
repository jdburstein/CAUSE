import { Controller, Get, Version, VERSION_NEUTRAL } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @Version(VERSION_NEUTRAL)
  getHealth(): { status: string } {
    return this.appService.getHealth();
  }
}
