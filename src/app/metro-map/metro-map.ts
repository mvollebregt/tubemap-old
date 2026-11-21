import { Component, input } from '@angular/core';
import { MetroLayout } from '../models/metro-layout.interface';

@Component({
  selector: 'app-metro-map',
  templateUrl: './metro-map.html',
  styleUrl: './metro-map.css',
})
export class MetroMapComponent {
  readonly layout = input.required<MetroLayout>();
  readonly lineColor = input.required<string>();

  isTransfer(name: string): boolean {
    return this.layout().transfers.some((transfer) => transfer.name === name);
  }
}
