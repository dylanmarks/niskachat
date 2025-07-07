import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { logger } from './app/utils/logger';

bootstrapApplication(App, appConfig).catch((err: unknown) => {
  logger.error(err);
});
