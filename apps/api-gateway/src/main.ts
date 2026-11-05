import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { sessionStore } from './auth/session-store.js';
import { createGatewayProxyMiddleware } from './proxy/gateway-proxy.middleware.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  sessionStore.start();
  app.use(cookieParser());
  app.use(createGatewayProxyMiddleware());
  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  await app.listen(process.env.PORT ?? 3001);
}
await bootstrap();
