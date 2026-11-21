import { Injectable } from '@angular/core';
import { MetroLayout } from '../models/metro-layout.interface';
import { PlacedStation } from '../models/placed-station.interface';

@Injectable({ providedIn: 'root' })
export class MetroMappingService {
  private readonly lineY = 160;
  private readonly labelYOffset = 34;

  layout(names: string[]): MetroLayout {
    const stations = names
      .map((name) => name.trim())
      .filter((name) => name.length > 0);

    if (stations.length === 0) {
      return { stations: [], path: '', viewBox: '0 0 100 100' };
    }

    const stationSpacing = Math.max(
      72,
      ...stations.map((name) => name.length * 8 + 24),
    );
    const placedStations = stations.map((name, index) =>
      this.placeStation(name, index, stations.length, stationSpacing),
    );
    const firstX = 0;
    const lastX = (stations.length - 1) * stationSpacing;
    const path = `M ${this.format(firstX)} ${this.lineY} L ${this.format(lastX)} ${this.lineY}`;
    const viewBox = `-60 55 ${this.format(lastX + 120)} 210`;

    return { stations: placedStations, path, viewBox };
  }

  private placeStation(
    name: string,
    index: number,
    stationCount: number,
    stationSpacing: number,
  ): PlacedStation {
    const x = index * stationSpacing;
    const labelOffset = -this.labelYOffset;
    const tick = index === 0 || index === stationCount - 1
      ? {
          x1: x,
          y1: this.lineY - 12,
          x2: x,
          y2: this.lineY + 12,
        }
      : {
          x1: x,
          y1: this.lineY - 12,
          x2: x,
          y2: this.lineY,
        };

    return {
      name,
      x,
      y: this.lineY,
      terminus: index === 0 || index === stationCount - 1,
      tick,
      label: {
        transform: `translate(${this.format(x)} ${this.format(this.lineY + labelOffset)})`,
        anchor: 'middle',
      },
    };
  }

  private format(value: number): string {
    return value.toFixed(2);
  }
}
