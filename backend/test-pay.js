const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./dist/app.module');
const { QuotesService } = require('./dist/quotes/quotes.service');

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const quotesService = app.get(QuotesService);
  try {
    const result = await quotesService.payQuote('fe1b7207-8148-4233-a093-4331f2d78866', '7dabbcfc-2519-4c2f-aab6-c181d88b9195');
    console.log('Success:', result);
  } catch (err) {
    console.error('Error:', err);
  }
  await app.close();
}
bootstrap();
