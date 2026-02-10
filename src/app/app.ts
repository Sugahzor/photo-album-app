import { Component, signal } from '@angular/core';
import { PhotoUploadComponent } from './photo-upload/photo-upload';

@Component({
  selector: 'app-root',
  imports: [PhotoUploadComponent],
  // templateUrl: './app.html',
  template: '<app-photo-upload></app-photo-upload>',
  styleUrl: './app.css',
})
export class App {
  protected readonly title = signal('photo-album-app');
}
