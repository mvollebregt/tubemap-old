import { Component, computed, inject, signal } from '@angular/core';
import { LineEditorComponent } from './line-editor/line-editor';
import { MetroMapComponent } from './metro-map/metro-map';
import { MetroMappingService } from './services/metro-mapping.service';
import { MetroLine } from './models/metro-line.interface';

const LINES: readonly MetroLine[] = [
  { name: 'Bakerloo', color: '#B36305' },
  { name: 'Central', color: '#E32017' },
  { name: 'Circle', color: '#FFD300' },
  { name: 'District', color: '#00782A' },
  { name: 'Elizabeth', color: '#7156A5' },
  { name: 'Hammersmith & City', color: '#F3A9BB' },
  { name: 'Jubilee', color: '#A0A5A9' },
  { name: 'Metropolitan', color: '#9B0056' },
  { name: 'Northern', color: '#000000' },
  { name: 'Piccadilly', color: '#003688' },
  { name: 'Victoria', color: '#0098D4' },
  { name: 'Waterloo & City', color: '#95CDBA' },
];

const VOORBEELD = `Groningen
Haren
Assen
Beilen
Hoogeveen
Meppel
Zwolle`;

@Component({
  selector: 'app-root',
  imports: [LineEditorComponent, MetroMapComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly mapping = inject(MetroMappingService);

  readonly lines = LINES;
  readonly text = signal(VOORBEELD);
  readonly lineColor = signal(LINES[0].color);
  readonly stations = computed(() =>
    this.text()
      .split(/\r?\n/)
      .map((station) => station.trim())
      .filter((station) => station.length > 0),
  );
  readonly map = computed(() => this.mapping.layout(this.stations()));
}
