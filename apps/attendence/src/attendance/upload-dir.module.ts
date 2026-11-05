import { Global, Module } from '@nestjs/common';
import { UploadDirService } from './upload-dir.service.js';

@Global()
@Module({
  providers: [UploadDirService],
  exports: [UploadDirService],
})
export class UploadDirModule {}
