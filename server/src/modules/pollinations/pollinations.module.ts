import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PollinationsService } from './services/pollinations.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 120000,
      maxRedirects: 3,
    }),
  ],
  providers: [PollinationsService],
  exports: [PollinationsService],
})
export class PollinationsModule {}
