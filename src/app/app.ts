import { Component, computed, inject, signal } from '@angular/core';
import { LineEditorComponent } from './line-editor/line-editor';
import { MetroMapComponent } from './metro-map/metro-map';
import { MetroMappingService } from './services/metro-mapping.service';
import { MetroLine } from './models/metro-line.interface';

const LINES: readonly MetroLine[] = [
  { name: 'Central', color: '#DC241F' },
  { name: 'Piccadilly', color: '#0019A8' },
  { name: 'Victoria', color: '#00A0E2' },
  { name: 'District', color: '#007D32' },
  { name: 'Elizabeth', color: '#6950A1' },
  { name: 'Northern', color: '#000000' },
  { name: 'Jubilee', color: '#7B8186' },
];

const VOORBEELD = `Groningen
Haren
Assen
Beilen
Hoogeveen
Meppel
Zwolle
Deventer
Apeldoorn
Amersfoort
Utrecht Centraal
Gouda
Rotterdam Centraal
Delft
Den Haag Centraal
Leiden
Schiphol
Amsterdam Zuid
Amsterdam Centraal`;

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
