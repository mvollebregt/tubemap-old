import { Injectable } from '@angular/core';
import { MetroLayout } from '../models/metro-layout.interface';
import { MetroLineLayout } from '../models/metro-line-layout.interface';
import { PlacedStation } from '../models/placed-station.interface';
import { TransferStation } from '../models/transfer-station.interface';

interface TextBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

@Injectable({ providedIn: 'root' })
export class MetroMappingService {
  private readonly lineY = 160;
  private readonly labelYOffset = 34;
  private readonly stationSpacing = 72;

  layout(
    lineNames: string[][],
    firstColor: string,
    secondColor: string,
  ): MetroLayout {
    const usableLines = lineNames
      .map((names) => names.map((name) => name.trim()).filter(Boolean))
      .filter((names) => names.length > 0);

    if (usableLines.length === 0) {
      return { stations: [], path: '', viewBox: '0 0 100 100', lines: [], transfers: [] };
    }

    const firstNames = usableLines[0];
    const horizontalSpacing = Math.max(
      72,
      ...firstNames.map((name) => name.length * 8 + 24),
    );
    const horizontalStations = firstNames.map((name, index) =>
      this.placeHorizontalStation(
        name,
        index,
        firstNames.length,
        index * horizontalSpacing,
      ),
    );

    const firstLine: MetroLineLayout = {
      color: firstColor,
      orientation: 'horizontal',
      stations: horizontalStations,
      path: `M ${this.format(0)} ${this.lineY} L ${this.format((firstNames.length - 1) * horizontalSpacing)} ${this.lineY}`,
    };

    const lines = [firstLine];
    const transfers: TransferStation[] = [];

    if (usableLines[1]) {
      const secondNames = usableLines[1];
      const sharedName = secondNames.find((name) =>
        horizontalStations.some((station) => station.name === name),
      );
      const sharedHorizontal = sharedName
        ? horizontalStations.find((station) => station.name === sharedName)
        : undefined;
      const sharedIndex = sharedName ? secondNames.indexOf(sharedName) : -1;
      const verticalX = sharedHorizontal?.x ?? (firstNames.length - 1) * horizontalSpacing + 180;

      const verticalStations = secondNames.map((name, index) =>
        this.placeVerticalStation(
          name,
          index,
          secondNames.length,
          verticalX,
          sharedName === name ? this.lineY : this.lineY + (index - sharedIndex) * 72,
        ),
      );

      const topY = Math.min(...verticalStations.map((station) => station.y));
      const bottomY = Math.max(...verticalStations.map((station) => station.y));
      const secondLine: MetroLineLayout = {
        color: secondColor,
        orientation: 'vertical',
        stations: verticalStations,
        path: `M ${this.format(verticalX)} ${this.format(topY)} L ${this.format(verticalX)} ${this.format(bottomY)}`,
      };
      lines.push(secondLine);

      horizontalStations.forEach((horizontalStation) => {
        const verticalStation = verticalStations.find(
          (station) => station.name === horizontalStation.name,
        );
        if (verticalStation) {
          transfers.push({
            name: horizontalStation.name,
            x: verticalStation.x,
            y: verticalStation.y,
            label: this.findTransferLabel(verticalStation.x, verticalStation.y),
          });
        }
      });
    }

    this.placeCollisionFreeLabels(lines, transfers);

    const allStations = lines.flatMap((line) => line.stations);
    const xs = allStations.map((station) => station.x);
    const ys = allStations.map((station) => station.y);
    const minX = Math.min(...xs) - 64;
    const maxX = Math.max(...xs) + 64;
    const minY = Math.min(...ys) - 64;
    const maxY = Math.max(...ys) + 64;
    const viewBox = `${this.format(minX)} ${this.format(minY)} ${this.format(maxX - minX)} ${this.format(maxY - minY)}`;

    return {
      stations: firstLine.stations,
      path: firstLine.path,
      viewBox,
      lines,
      transfers,
    };
  }

  private placeHorizontalStation(
    name: string,
    index: number,
    stationCount: number,
    x: number,
  ): PlacedStation {
    const terminal = index === 0 || index === stationCount - 1;
    return {
      name,
      x,
      y: this.lineY,
      terminus: terminal,
      tick: terminal
        ? { x1: x, y1: this.lineY - 12, x2: x, y2: this.lineY + 12 }
        : { x1: x, y1: this.lineY - 12, x2: x, y2: this.lineY },
      label: {
        transform: `translate(${this.format(x)} ${this.format(this.lineY - this.labelYOffset)})`,
        anchor: 'middle',
      },
    };
  }

  private placeVerticalStation(
    name: string,
    index: number,
    stationCount: number,
    x: number,
    y: number,
  ): PlacedStation {
    const terminal = index === 0 || index === stationCount - 1;
    return {
      name,
      x,
      y,
      terminus: terminal,
      tick: terminal
        ? { x1: x - 12, y1: y, x2: x + 12, y2: y }
        : { x1: x, y1: y, x2: x + 12, y2: y },
      label: {
        transform: `translate(${this.format(x + 18)} ${this.format(y - 5)})`,
        anchor: 'start',
      },
    };
  }

  private findTransferLabel(x: number, y: number) {
    return {
      transform: `translate(${this.format(x + 18)} ${this.format(y - 18)})`,
      anchor: 'start' as const,
    };
  }

  private placeCollisionFreeLabels(
    lines: MetroLineLayout[],
    transfers: TransferStation[],
  ): void {
    const boxes: TextBox[] = [];
    const transferNames = new Set(transfers.map((transfer) => transfer.name));

    lines.forEach((line) => {
      line.stations.forEach((station) => {
        if (transferNames.has(station.name)) return;
        const width = station.name.length * 8;
        const candidates = line.orientation === 'horizontal'
          ? [
              { x: station.x - width / 2, y: station.y - 46 },
              { x: station.x - width - 8, y: station.y - 46 },
              { x: station.x + 8, y: station.y - 46 },
              { x: station.x - width / 2, y: station.y - 66 },
            ]
          : [
              { x: station.x + 18, y: station.y - 10 },
              { x: station.x + 18, y: station.y - 24 },
              { x: station.x + 18, y: station.y + 12 },
              { x: station.x - width - 18, y: station.y - 10 },
            ];

        const candidate = candidates.find((position) =>
          this.textFits(position.x, position.y - 14, width, 18, boxes, lines, transfers),
        ) ?? candidates[0];
        const anchor = line.orientation === 'horizontal'
          ? 'middle'
          : candidate.x < station.x
            ? 'end'
            : 'start';
        station.label = {
          transform: `translate(${this.format(
            anchor === 'middle' ? candidate.x + width / 2 : candidate.x,
          )} ${this.format(candidate.y + 14)})`,
          anchor,
        };
        boxes.push({ x: candidate.x - 3, y: candidate.y - 14, width: width + 6, height: 18 });
      });
    });

    transfers.forEach((transfer) => {
      const width = transfer.name.length * 8;
      const candidates = [
        { x: transfer.x + 18, y: transfer.y - 24 },
        { x: transfer.x - width - 18, y: transfer.y - 24 },
        { x: transfer.x + 18, y: transfer.y + 14 },
        { x: transfer.x - width - 18, y: transfer.y + 14 },
      ];
      const candidate = candidates.find((position) =>
        this.textFits(position.x, position.y - 14, width, 18, boxes, lines, transfers),
      ) ?? candidates[0];
      transfer.label = {
        transform: `translate(${this.format(candidate.x)} ${this.format(candidate.y)})`,
        anchor: 'start',
      };
      boxes.push({ x: candidate.x - 3, y: candidate.y - 14, width: width + 6, height: 18 });
    });
  }

  private textFits(
    x: number,
    y: number,
    width: number,
    height: number,
    boxes: TextBox[],
    lines: MetroLineLayout[],
    transfers: TransferStation[],
  ): boolean {
    const box = { x, y, width, height };
    if (boxes.some((other) => this.boxesOverlap(box, other))) return false;

    const overlapsLine = lines.some((line) => {
      if (line.orientation === 'horizontal') {
        return y <= line.stations[0].y + 12 &&
          y + height >= line.stations[0].y - 12 &&
          x < Math.max(...line.stations.map((station) => station.x)) + 12 &&
          x + width > Math.min(...line.stations.map((station) => station.x)) - 12;
      }
      const xPosition = line.stations[0].x;
      const minY = Math.min(...line.stations.map((station) => station.y));
      const maxY = Math.max(...line.stations.map((station) => station.y));
      return x < xPosition + 12 &&
        x + width > xPosition - 12 &&
        y < maxY + 12 &&
        y + height > minY - 12;
    });
    if (overlapsLine) return false;

    const symbols = [
      ...lines.flatMap((line) =>
        line.stations.map((station) => ({ x: station.x, y: station.y })),
      ),
      ...transfers.map((transfer) => ({ x: transfer.x, y: transfer.y })),
    ];
    return !symbols.some((symbol) =>
      this.distanceToBox(symbol.x, symbol.y, box) < 13,
    );
  }

  private boxesOverlap(a: TextBox, b: TextBox): boolean {
    return a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y;
  }

  private distanceToBox(x: number, y: number, box: TextBox): number {
    const dx = Math.max(box.x - x, 0, x - (box.x + box.width));
    const dy = Math.max(box.y - y, 0, y - (box.y + box.height));
    return Math.hypot(dx, dy);
  }

  private format(value: number): string {
    return value.toFixed(2);
  }
}
