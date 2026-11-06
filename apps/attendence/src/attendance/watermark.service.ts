import { Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { formatStamp } from './time.js';

export interface WatermarkInput {
  fullName: string;
  recordedAt: Date;
  workDate: string;
  latitude: number | null;
  longitude: number | null;
  locationAccuracy: number | null;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCoords(input: WatermarkInput): string {
  if (input.latitude === null || input.longitude === null) {
    return 'Location not available';
  }
  const accuracy =
    input.locationAccuracy === null
      ? ''
      : ` (+/-${Math.round(input.locationAccuracy)} m)`;
  return `${input.latitude.toFixed(5)}, ${input.longitude.toFixed(5)}${accuracy}`;
}

@Injectable()
export class WatermarkService {
  private readonly logger = new Logger(WatermarkService.name);

  async apply(
    sourcePath: string,
    destinationPath: string,
    input: WatermarkInput,
  ): Promise<boolean> {
    try {
      const image = sharp(sourcePath);
      const meta = await image.metadata();
      const width = meta.width ?? 0;
      const height = meta.height ?? 0;
      if (!width || !height) return false;
      const scale = Math.max(1, Math.round(width / 900));
      const lines = [
        escapeXml(input.fullName),
        `${formatStamp(input.recordedAt)} | ${input.workDate}`,
        formatCoords(input),
      ];

      const padX = 16 * scale;
      const padY = 12 * scale;
      const lineHeight = 22 * scale;
      const fontSize = 17 * scale;
      const blockHeight = lineHeight * lines.length + padY * 2;

      const text = lines
        .map(
          (line, index) =>
            `<text x="${padX}" y="${padY + fontSize + index * lineHeight}" font-family="DejaVu Sans, Arial, sans-serif" font-size="${fontSize}" fill="#ffffff">${line}</text>`,
        )
        .join('');

      const svg = `<svg width="${width}" height="${blockHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${blockHeight}" fill="#000000" opacity="0.62" />
        ${text}
      </svg>`;

      await image
        .composite([
          {
            input: Buffer.from(svg),
            top: Math.max(0, height - blockHeight),
            left: 0,
          },
        ])
        .jpeg({ quality: 88 })
        .toFile(destinationPath);

      return true;
    } catch (error) {
      this.logger.warn(`Watermark failed: ${String(error)}`);
      return false;
    }
  }
}
