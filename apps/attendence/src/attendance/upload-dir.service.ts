import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export function extForMime(mimetype: string): string {
  return EXT_BY_MIME[mimetype] ?? '.bin';
}

@Injectable()
export class UploadDirService implements OnModuleInit {
  readonly dir: string;

  constructor(config: ConfigService) {
    this.dir = resolve(config.get<string>('ATTENDENCE_UPLOAD_DIR') ?? './uploads');
  }

  onModuleInit() {
    mkdirSync(this.dir, { recursive: true });
  }

  pathFor(filename: string): string {
    return join(this.dir, filename);
  }
}
