import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';


async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: [`'self'`],
          // Cho phép Swagger tải các script nội bộ và từ các nguồn CDN cần thiết
          scriptSrc: [`'self'`, `'unsafe-inline'`, `'unsafe-eval'`, 'https://cdnjs.cloudflare.com'],
          // Cho phép Swagger tải CSS định dạng
          styleSrc: [`'self'`, `'unsafe-inline'`, 'https://cdnjs.cloudflare.com', 'https://fonts.googleapis.com'],
          // Cho phép tải các font chữ từ Google Fonts nếu Swagger/Giao diện cần
          fontSrc: [`'self'`, 'https://fonts.gstatic.com'],
          imgSrc: [`'self'`, 'data:', 'https://swagger.io'],
        },
      },
    }),
  ); app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  });

  // 1. Cấu hình thông tin cơ bản cho tài liệu API
  const config = new DocumentBuilder()
    .setTitle('Dự án NestJS API')
    .setDescription('Tài liệu hướng dẫn sử dụng các endpoint API của hệ thống')
    .setVersion('1.0')
    .addBearerAuth() // (Tùy chọn) Thêm nút khóa "Authorize" nếu bạn dùng JWT Auth
    .build();

  // 2. Tạo tài liệu từ cấu hình trên
  const document = SwaggerModule.createDocument(app, config);

  // 3. Thiết lập đường dẫn để truy cập trang Swagger (ví dụ: http://localhost:3000/api)
  SwaggerModule.setup('api', app, document);

  await app.listen(process.env.PORT ?? 3000);


}
bootstrap();
