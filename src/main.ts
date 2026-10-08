import { bootstrapApplication } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { AppComponent } from './app/app';

bootstrapApplication(AppComponent, { providers: [provideZonelessChangeDetection()] })
  .catch((error: unknown) => console.error('Unable to start Iron Nest FCC', error));
