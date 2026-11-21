import { Component, computed, signal } from '@angular/core';
import { layoutMetroLines } from './metro-layout';
import { LineEditorComponent, MetroLine } from './line-editor/line-editor';
import { MetroMapComponent } from './metro-map/metro-map';

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
  readonly lines = LINES;

  readonly text = signal(VOORBEELD);
  readonly lineColor = signal(LINES[0].color);
  readonly perRow = signal(6);

  readonly stations = computed(() =>
    this.text()
      .split(/\n[^\S\n]*\n/)
      .map((block) =>
        block
          .split('\n')
          .map((station) => station.trim())
          .filter(Boolean),
      )
      .filter((line) => line.length > 0),
  );

  readonly map = computed(() => {
    const lineColors = [
      this.lineColor(),
      ...LINES.map((line) => line.color).filter((color) => color !== this.lineColor()),
    ];
    return layoutMetroLines(this.stations(), this.perRow(), lineColors);
  });

  setPerRow(value: number | string | null) {
    const n = Math.round(Number(value) || 6);
    this.perRow.set(Math.min(12, Math.max(3, n)));
  }
}
