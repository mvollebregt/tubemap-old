import { Injectable } from '@angular/core';
import { MetroLayout } from '../models/metro-layout.interface';
import { MetroLineLayout } from '../models/metro-line-layout.interface';
import { PlacedStation } from '../models/placed-station.interface';
import { StationLabel } from '../models/station-label.interface';
import { TransferStation } from '../models/transfer-station.interface';

interface Point {
  x: number;
  y: number;
}

interface OverlapRun {
  lineIndices: number[];
  names: string[];
}

interface TextBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

@Injectable({ providedIn: 'root' })
export class MetroMappingService {
  private readonly lineWidth = 10;
  private readonly stationSpacing = 72;
  private readonly laneSpacing = 10;
  private readonly parallelLaneOffset = 5;
  private readonly baseY = 155;

  layout(
    lineNames: string[][],
    firstColor: string | string[],
    secondColor = '',
  ): MetroLayout {
    const names = lineNames
      .map((stations) => stations.map((name) => name.trim()).filter(Boolean))
      .filter((stations) => stations.length > 0);

    if (names.length === 0) {
      return { stations: [], path: '', viewBox: '0 0 100 100', lines: [], transfers: [] };
    }

    const colors = Array.isArray(firstColor)
      ? firstColor
      : [firstColor, secondColor].filter(Boolean);

    const firstSpacing = Math.max(
      72,
      ...names[0].map((name) => name.length * 8 + 24),
    );
    const masterPositions = new Map<string, Point>();
    const basePositions: Array<Array<{ name: string; point: Point }>> = [];
    names.forEach((stationNames, lineIndex) => {
      if (lineIndex === 0) {
        const stations = stationNames.map((name, stationIndex) => ({
          name,
          point: { x: stationIndex * firstSpacing, y: this.baseY },
        }));
        basePositions.push(stations);
        stations.forEach(({ name, point }) => masterPositions.set(name, point));
        return;
      }

      const orientation = lineIndex % 2 === 1 ? 'vertical' : 'horizontal';
      const bandOffset = (lineIndex + 1) * 180;
      const existingNames = stationNames.filter((name) => masterPositions.has(name));
      const anchor = existingNames.length
        ? masterPositions.get(existingNames[0])!
        : undefined;

      const stations = stationNames.map((name, stationIndex) => {
        if (masterPositions.has(name)) {
          return { name, point: { ...masterPositions.get(name)! } };
        }
        if (orientation === 'vertical') {
          return {
            name,
            point: {
              x: anchor?.x ?? this.rightEdge(names, firstSpacing) + bandOffset,
              y: this.baseY + (stationIndex - stationNames.indexOf(existingNames[0] ?? stationNames[0])) * this.stationSpacing,
            },
          };
        }
        return {
          name,
          point: {
            x: anchor?.x
              ? anchor.x + (stationIndex - stationNames.indexOf(existingNames[0] ?? stationNames[0])) * this.stationSpacing
              : stationIndex * this.stationSpacing,
            y: this.baseY + bandOffset,
          },
        };
      });
      basePositions.push(stations);
      stations.forEach(({ name, point }) => {
        if (!masterPositions.has(name)) masterPositions.set(name, point);
      });
    });

    const overlapRuns = this.findAllOverlapRuns(names);
    const parallelRuns = overlapRuns.filter((run) => run.names.length >= 2);

    basePositions.forEach((stations, lineIndex) => {
      stations.forEach(({ name, point }) => {
        if (basePositions.length > 1 &&
            this.isDirectConsecutiveMatch(basePositions[0], basePositions[1], name)) {
          const master = basePositions[0].find((station) => station.name === name)?.point ?? point;
          point.x = master.x;
          point.y = lineIndex === 0
            ? master.y - this.parallelLaneOffset
            : lineIndex === 1
              ? master.y + this.parallelLaneOffset
              : point.y;
          return;
        }
        const participatingLines = this.parallelLineMembership(basePositions, name);
        if (participatingLines.length < 2) return;
        const rank = participatingLines.indexOf(lineIndex);
        const offset = (rank - (participatingLines.length - 1) / 2) * this.laneSpacing;
        const master = basePositions[0].find((station) => station.name === name)?.point ?? point;
        point.x = master.x;
        if (lineIndex <= 1 && basePositions.length > 1) {
          point.y = lineIndex === 0
            ? master.y - this.parallelLaneOffset
            : master.y + this.parallelLaneOffset;
        } else {
          point.y = master.y + offset;
        }
      });
    });

    if (basePositions.length > 1) {
      let firstIndex = 0;
      while (firstIndex < names[0].length) {
        const secondIndex = names[1].indexOf(names[0][firstIndex]);
        if (secondIndex < 0) {
          firstIndex++;
          continue;
        }
        let runLength = 0;
        while (
          firstIndex + runLength < names[0].length &&
          secondIndex + runLength < names[1].length &&
          names[0][firstIndex + runLength] === names[1][secondIndex + runLength]
        ) {
          runLength++;
        }
        if (runLength >= 2) {
          const firstSharedName = names[0][firstIndex];
          const lastSharedName = names[0][firstIndex + runLength - 1];
          basePositions[0].forEach((station) => {
            station.point.y = 155 - this.parallelLaneOffset;
          });
          const firstShared = basePositions[0].find((station) => station.name === firstSharedName);
          const lastShared = basePositions[0].find((station) => station.name === lastSharedName);
          const secondFirstIndex = names[1].indexOf(firstSharedName);
          const secondLastIndex = names[1].indexOf(lastSharedName);

          if (firstShared && secondFirstIndex >= 0) {
            basePositions[1].forEach((station, stationIndex) => {
              if (stationIndex < secondFirstIndex) {
                station.point.x = firstShared.point.x;
                station.point.y = 155 - (secondFirstIndex - stationIndex) * 72;
              } else if (stationIndex > secondLastIndex) {
                station.point.x = lastShared?.point.x ?? firstShared.point.x;
                station.point.y = 160 + (stationIndex - secondLastIndex) * 72;
              }
            });
          }

          for (let offset = 0; offset < runLength; offset++) {
            const name = names[0][firstIndex + offset];
            const firstStation = basePositions[0].find((station) => station.name === name);
            const secondStation = basePositions[1].find((station) => station.name === name);
            if (firstStation) firstStation.point.y = 155 - this.parallelLaneOffset;
            if (secondStation) {
              secondStation.point.x = firstStation?.point.x ?? secondStation.point.x;
              secondStation.point.y = 155 + this.parallelLaneOffset;
            }
          }
          firstIndex += runLength;
        } else {
          firstIndex++;
        }
      }
    }

    const positionByLine = basePositions.map((stations) =>
      stations.map(({ name, point }) => ({
        name,
        point: { ...point },
      })),
    );
    positionByLine.forEach((stations) => {
      stations.forEach(({ name, point }) => {
        masterPositions.set(name, point);
      });
    });

    const lines: MetroLineLayout[] = names.map((stationNames, lineIndex) => {
      const orientation = lineIndex === 0
        ? 'horizontal'
        : lineIndex % 2 === 1
          ? 'vertical'
          : 'horizontal';
      const stations = positionByLine[lineIndex].map(({ name, point }, stationIndex) =>
        this.placeStation(
          name,
          point,
          stationIndex,
          stationNames.length,
          orientation,
        ),
      );

      return {
        color: colors[lineIndex] ?? this.fallbackColor(lineIndex),
        orientation,
        stations,
        path: this.buildPath(stations),
        sharedStationNames: this.sharedNamesForLine(names, lineIndex),
        boundaryStationNames: this.boundaryNamesForLine(names, overlapRuns, lineIndex),
      };
    });

    const transfers = this.findTransfers(names, lines, overlapRuns);
    this.alignStationTicks(lines, transfers);
    this.placeLabels(lines, transfers);

    const allStations = lines.flatMap((line) => line.stations);
    const xs = allStations.map((station) => station.x);
    const ys = allStations.map((station) => station.y);
    const minX = Math.min(...xs) - 72;
    const maxX = Math.max(...xs) + 72;
    const minY = Math.min(...ys) - 72;
    const maxY = Math.max(...ys) + 72;

    return {
      stations: lines[0].stations,
      path: lines[0].path,
      viewBox: `${this.format(minX)} ${this.format(minY)} ${this.format(maxX - minX)} ${this.format(maxY - minY)}`,
      lines,
      transfers,
    };
  }

  private rightEdge(names: string[][], spacing: number): number {
    return Math.max(
      0,
      names[0].length - 1,
    ) * spacing;
  }

  private fallbackColor(index: number): string {
    const palette = [
      '#B36305',
      '#E32017',
      '#FFD300',
      '#00782A',
      '#7156A5',
      '#F3A9BB',
      '#A0A5A9',
      '#9B0056',
      '#000000',
      '#003688',
      '#0098D4',
      '#95CDBA',
    ];
    return palette[index % palette.length];
  }

  private placeStation(
    name: string,
    point: Point,
    index: number,
    stationCount: number,
    orientation: 'horizontal' | 'vertical' | 'diagonal',
  ): PlacedStation {
    const terminal = index === 0 || index === stationCount - 1;
    let tick = this.tickForOrientation(point, orientation, terminal);

    return {
      name,
      x: point.x,
      y: point.y,
      terminus: terminal,
      tick,
      label: {
        transform: `translate(${this.format(point.x)} ${this.format(point.y - 34)})`,
        anchor: 'middle',
      },
    };
  }

  private tickForOrientation(
    point: Point,
    orientation: 'horizontal' | 'vertical' | 'diagonal',
    terminal: boolean,
  ) {
    if (orientation === 'horizontal') {
      return terminal
        ? { x1: point.x, y1: point.y - 12, x2: point.x, y2: point.y + 12 }
        : { x1: point.x, y1: point.y - 12, x2: point.x, y2: point.y };
    }
    if (orientation === 'vertical') {
      return terminal
        ? { x1: point.x - 12, y1: point.y, x2: point.x + 12, y2: point.y }
        : { x1: point.x, y1: point.y, x2: point.x + 12, y2: point.y };
    }
    return {
      x1: point.x,
      y1: point.y,
      x2: point.x,
      y2: point.y - 12,
    };
  }

  private isDirectConsecutiveMatch(
    first: Array<{ name: string; point: Point }>,
    second: Array<{ name: string; point: Point }>,
    name: string,
  ): boolean {
    const firstIndex = first.findIndex((station) => station.name === name);
    const secondIndex = second.findIndex((station) => station.name === name);
    if (firstIndex < 0 || secondIndex < 0) return false;

    let runLength = 1;
    let left = 1;
    while (
      firstIndex - left >= 0 &&
      secondIndex - left >= 0 &&
      first[firstIndex - left].name === second[secondIndex - left].name
    ) {
      left++;
      runLength++;
    }
    let right = 1;
    while (
      firstIndex + right < first.length &&
      secondIndex + right < second.length &&
      first[firstIndex + right].name === second[secondIndex + right].name
    ) {
      right++;
      runLength++;
    }
    return runLength >= 2;
  }

  private parallelLineMembership(
    basePositions: Array<Array<{ name: string; point: Point }>>,
    name: string,
  ): number[] {
    const membership = new Set<number>();

    for (let first = 0; first < basePositions.length; first++) {
      const firstIndex = basePositions[first].findIndex((station) => station.name === name);
      if (firstIndex < 0) continue;
      for (let second = first + 1; second < basePositions.length; second++) {
        const secondIndex = basePositions[second].findIndex((station) => station.name === name);
        if (secondIndex < 0) continue;

        const firstNames = basePositions[first].map((station) => station.name);
        const secondNames = basePositions[second].map((station) => station.name);
        let length = 1;
        while (
          firstIndex - length >= 0 &&
          secondIndex - length >= 0 &&
          firstNames[firstIndex - length] === secondNames[secondIndex - length]
        ) {
          length++;
        }
        let right = 1;
        while (
          firstIndex + right < firstNames.length &&
          secondIndex + right < secondNames.length &&
          firstNames[firstIndex + right] === secondNames[secondIndex + right]
        ) {
          right++;
        }
        if (length + right - 1 >= 2) {
          membership.add(first);
          membership.add(second);
        }
      }
    }

    return [...membership].sort((a, b) => a - b);
  }

  private findAllOverlapRuns(names: string[][]): OverlapRun[] {
    const runs: OverlapRun[] = [];
    for (let first = 0; first < names.length; first++) {
      for (let second = first + 1; second < names.length; second++) {
        let firstIndex = 0;
        while (firstIndex < names[first].length) {
          const secondIndex = names[second].indexOf(names[first][firstIndex]);
          if (secondIndex < 0) {
            firstIndex++;
            continue;
          }
          let length = 0;
          while (
            firstIndex + length < names[first].length &&
            secondIndex + length < names[second].length &&
            names[first][firstIndex + length] === names[second][secondIndex + length]
          ) {
            length++;
          }
          if (length > 0) {
            const existing = runs.find((run) =>
              run.names.every((name, index) =>
                names[first][firstIndex + index] === name,
              ),
            );
            if (existing) {
              if (!existing.lineIndices.includes(first)) existing.lineIndices.push(first);
              if (!existing.lineIndices.includes(second)) existing.lineIndices.push(second);
            } else {
              runs.push({
                lineIndices: [first, second],
                names: names[first].slice(firstIndex, firstIndex + length),
              });
            }
            firstIndex += length;
          } else {
            firstIndex++;
          }
        }
      }
    }
    return runs;
  }

  private sharedNamesForLine(names: string[][], lineIndex: number): string[] {
    const counts = new Map<string, number>();
    names[lineIndex].forEach((name) => counts.set(name, 1));
    names.forEach((stationNames, otherIndex) => {
      if (otherIndex === lineIndex) return;
      stationNames.forEach((name) => {
        if (counts.has(name)) counts.set(name, counts.get(name)! + 1);
      });
    });
    return names[lineIndex].filter((name) => counts.get(name)! > 1);
  }

  private boundaryNamesForLine(
    names: string[][],
    runs: OverlapRun[],
    lineIndex: number,
  ): string[] {
    const boundary = new Set<string>();
    runs.forEach((run) => {
      if (!run.lineIndices.includes(lineIndex)) return;
      if (run.names.length === 1) boundary.add(run.names[0]);
      else {
        boundary.add(run.names[0]);
        boundary.add(run.names[run.names.length - 1]);
      }
    });
    return [...boundary];
  }

  private findTransfers(
    names: string[][],
    lines: MetroLineLayout[],
    runs: OverlapRun[],
  ): TransferStation[] {
    const transferNames = new Set<string>();
    runs.forEach((run) => {
      if (run.names.length === 1) transferNames.add(run.names[0]);
      else {
        transferNames.add(run.names[0]);
        transferNames.add(run.names[run.names.length - 1]);
      }
    });

    names.forEach((stationNames) => {
      stationNames.forEach((name) => {
        const lineCount = names.filter((line) => line.includes(name)).length;
        if (lineCount === 1) return;
        const belongsToParallelRun = runs.some(
          (run) => run.names.includes(name) && run.names.length >= 2,
        );
        if (!belongsToParallelRun) transferNames.add(name);
      });
    });

    const transfers: TransferStation[] = [];
    transferNames.forEach((name) => {
      const station = lines
        .flatMap((line) => line.stations)
        .find((item) => item.name === name);
      if (!station) return;
      transfers.push({
        name,
        x: station.x,
        y: station.y,
        label: {
          transform: `translate(${this.format(station.x + 18)} ${this.format(station.y - 18)})`,
          anchor: 'start',
        },
      });
    });
    return transfers;
  }

  private buildPath(stations: PlacedStation[]): string {
    if (stations.length === 0) return '';
    let path = `M ${this.format(stations[0].x)} ${this.format(stations[0].y)}`;
    for (let index = 1; index < stations.length; index++) {
      const previous = stations[index - 1];
      const current = stations[index];
      path += this.normalizedSegment(previous, current);
    }
    return path;
  }

  private normalizedSegment(from: Point, to: Point): string {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (dx === 0 || dy === 0) {
      return ` L ${this.format(to.x)} ${this.format(to.y)}`;
    }
    if (Math.abs(dx) === Math.abs(dy)) {
      return ` L ${this.format(to.x)} ${this.format(to.y)}`;
    }
    const horizontalFirst = Math.abs(dx) >= Math.abs(dy);
    if (horizontalFirst) {
      return ` L ${this.format(to.x)} ${this.format(from.y)} L ${this.format(to.x)} ${this.format(to.y)}`;
    }
    return ` L ${this.format(from.x)} ${this.format(to.y)} L ${this.format(to.x)} ${this.format(to.y)}`;
  }

  private alignStationTicks(lines: MetroLineLayout[], transfers: TransferStation[]): void {
    const transferNames = new Set(transfers.map((transfer) => transfer.name));
    lines.forEach((line) => {
      line.stations.forEach((station, index) => {
        if (transferNames.has(station.name)) return;
        const previous = line.stations[index - 1];
        const next = line.stations[index + 1];
        const tangent = this.tangentBetween(previous, station, next);

        let normalX = -tangent.y;
        let normalY = tangent.x;
        if (Math.abs(tangent.x) >= 0.99) {
          normalX = 0;
          normalY = -1;
        } else if (Math.abs(tangent.y) >= 0.99) {
          normalX = 1;
          normalY = 0;
        }

        if (station.terminus) {
          station.tick = {
            x1: station.x - normalX * 12,
            y1: station.y - normalY * 12,
            x2: station.x + normalX * 12,
            y2: station.y + normalY * 12,
          };
        } else {
          station.tick = {
            x1: station.x,
            y1: station.y,
            x2: station.x + normalX * 12,
            y2: station.y + normalY * 12,
          };
        }
      });
    });
  }

  private tangentBetween(
    previous: PlacedStation | undefined,
    station: PlacedStation,
    next: PlacedStation | undefined,
  ): Point {
    let x = 0;
    let y = 0;
    [previous, next].forEach((neighbor) => {
      if (!neighbor) return;
      const dx = neighbor.x - station.x;
      const dy = neighbor.y - station.y;
      const length = Math.hypot(dx, dy);
      if (length > 0) {
        x += dx / length;
        y += dy / length;
      }
    });
    const length = Math.hypot(x, y);
    if (length === 0) return { x: 1, y: 0 };
    return { x: x / length, y: y / length };
  }

  private placeLabels(lines: MetroLineLayout[], transfers: TransferStation[]): void {
    const occupied: TextBox[] = [];
    const transferNames = new Set(transfers.map((transfer) => transfer.name));

    lines.forEach((line) => {
      line.stations.forEach((station) => {
        if (transferNames.has(station.name)) return;
        if (line.sharedStationNames.includes(station.name) &&
            line.orientation === 'vertical') {
          return;
        }
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
              { x: station.x - width - 18, y: station.y - 10 },
              { x: station.x + 18, y: station.y + 12 },
            ];

        const candidate = candidates.find((position) =>
          this.labelFits(position.x, position.y - 14, width, 18, occupied, lines),
        ) ?? candidates[0];
        const middle = line.orientation === 'horizontal';
        station.label = {
          transform: `translate(${this.format(middle ? candidate.x + width / 2 : candidate.x)} ${this.format(candidate.y + 14)})`,
          anchor: middle ? 'middle' : candidate.x < station.x ? 'end' : 'start',
        };
        occupied.push({
          x: candidate.x - 3,
          y: candidate.y - 14,
          width: width + 6,
          height: 18,
        });
      });
    });
  }

  private labelFits(
    x: number,
    y: number,
    width: number,
    height: number,
    occupied: TextBox[],
    lines: MetroLineLayout[],
  ): boolean {
    if (occupied.some((box) =>
      x < box.x + box.width &&
      x + width > box.x &&
      y < box.y + box.height &&
      y + height > box.y,
    )) return false;

    return !lines.some((line) => {
      if (line.orientation === 'horizontal') {
        const minX = Math.min(...line.stations.map((station) => station.x));
        const maxX = Math.max(...line.stations.map((station) => station.x));
        const lineY = line.stations[0].y;
        return y < lineY + 12 &&
          y + height > lineY - 12 &&
          x < maxX + 12 &&
          x + width > minX - 12;
      }
      const lineX = line.stations[0].x;
      const minY = Math.min(...line.stations.map((station) => station.y));
      const maxY = Math.max(...line.stations.map((station) => station.y));
      return x < lineX + 12 &&
        x + width > lineX - 12 &&
        y < maxY + 12 &&
        y + height > minY - 12;
    });
  }

  private format(value: number): string {
    return value.toFixed(2);
  }
}
