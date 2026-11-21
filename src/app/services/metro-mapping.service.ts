import { Injectable } from '@angular/core';
import { MetroLayout } from '../models/metro-layout.interface';
import { MetroLineLayout } from '../models/metro-line-layout.interface';
import { PlacedStation } from '../models/placed-station.interface';
import { StationTick } from '../models/station-tick.interface';
import { TransferStation } from '../models/transfer-station.interface';

interface Point {
  x: number;
  y: number;
}

interface OverlapRun {
  names: string[];
  lineIndices: number[];
}

@Injectable({ providedIn: 'root' })
export class MetroMappingService {
  private readonly baseY = 155;
  private readonly spacing = 72;
  private readonly parallelGap = 10;

  layout(
    lineNames: string[][],
    firstColor: string | string[],
    secondColor = '',
  ): MetroLayout {
    const names = lineNames
      .map((stations) => stations.map((name) => name.trim()).filter(Boolean))
      .filter((stations) => stations.length > 0);

    if (names.length === 0) {
      return {
        stations: [],
        path: '',
        viewBox: '0 0 100 100',
        lines: [],
        transfers: [],
      };
    }

    const colors = Array.isArray(firstColor)
      ? firstColor
      : [firstColor, secondColor].filter(Boolean);
    const firstSpacing = Math.max(
      72,
      ...names[0].map((name) => name.length * 8 + 24),
    );
    const overlapRunsEarly = this.findOverlapRuns(names);
    const masterPositions = new Map<string, Point>();
    const basePositions: Array<Array<{ name: string; point: Point }>> = [];

    names.forEach((stationNames, lineIndex) => {
      const startsInParallelRun = overlapRunsEarly.some((run) =>
        run.names.length >= 2 &&
        run.names.includes(stationNames[0]),
      );
      const orientation = lineIndex > 1 && startsInParallelRun
        ? 'vertical'
        : this.orientationForLine(lineIndex);

      if (lineIndex === 0) {
        const stations = stationNames.map((name, stationIndex) => ({
          name,
          point: { x: stationIndex * firstSpacing, y: this.baseY },
        }));
        basePositions.push(stations);
        stations.forEach(({ name, point }) =>
          masterPositions.set(name, { ...point }),
        );
        return;
      }

      const sharedName = stationNames.find((name) => masterPositions.has(name));
      const sharedIndex = sharedName ? stationNames.indexOf(sharedName) : -1;
      const anchor = sharedName ? masterPositions.get(sharedName)! : undefined;
      const horizontalBranchSide =
        orientation === 'horizontal' && sharedIndex === 0 && anchor
          ? this.horizontalBranchSide(
              stationNames.slice(1).filter((name) => !masterPositions.has(name)),
              anchor,
              firstSpacing,
              basePositions,
            )
          : -1;

      const stations = stationNames.map((name, stationIndex) => {
        if (masterPositions.has(name)) {
          return { name, point: { ...masterPositions.get(name)! } };
        }

        const previousSharedName = stationNames
          .slice(0, stationIndex)
          .reverse()
          .find((candidate) => masterPositions.has(candidate));
        if (previousSharedName && orientation === 'vertical') {
          const previousShared = masterPositions.get(previousSharedName)!;
          return {
            name,
            point: {
              x: previousShared.x,
              y: previousShared.y + (stationIndex - stationNames.indexOf(previousSharedName)) * this.spacing,
            },
          };
        }

        if (anchor) {
          const distance = stationIndex - sharedIndex;
          if (orientation === 'vertical') {
            return {
              name,
              point: {
                x: anchor.x,
                y: anchor.y + distance * this.spacing,
              },
            };
          }

          const side = sharedIndex === 0 && stationIndex > 0
            ? horizontalBranchSide
            : stationIndex > sharedIndex
              ? 1
              : -1;
          return {
            name,
            point: {
              x: anchor.x + side * Math.abs(distance) * firstSpacing,
              y: anchor.y,
            },
          };
        }

        if (orientation === 'horizontal') {
          return {
            name,
            point: {
              x: stationIndex * firstSpacing,
              y: this.baseY + (lineIndex + 1) * 180,
            },
          };
        }
        return {
          name,
          point: {
            x: this.rightEdge(names, firstSpacing) + lineIndex * 180,
            y: this.baseY + stationIndex * this.spacing,
          },
        };
      });

      basePositions.push(stations);
      stations.forEach(({ name, point }) => {
        if (!masterPositions.has(name)) {
          masterPositions.set(name, { ...point });
        }
      });
    });

    const overlapRuns = this.findOverlapRuns(names);
    this.placeParallelRuns(basePositions, overlapRuns);
    basePositions.forEach((stations, lineIndex) => {
      if (lineIndex === 0) return;
      const startsInParallelRun = overlapRunsEarly.some((run) =>
        run.names.length >= 2 &&
        run.names.includes(names[lineIndex][0]),
      );
      const orientation = lineIndex > 1 && startsInParallelRun
        ? 'vertical'
        : this.orientationForLine(lineIndex);
      if (orientation !== 'horizontal') return;
      this.avoidStationCollisions(
        stations,
        basePositions.slice(0, lineIndex),
        new Set(this.sharedNamesForLine(names, lineIndex)),
      );
    });

    const lines: MetroLineLayout[] = names.map((stationNames, lineIndex) => {
      const startsInParallelRun = overlapRunsEarly.some((run) =>
        run.names.length >= 2 &&
        run.names.includes(stationNames[0]),
      );
      const orientation = lineIndex > 1 && startsInParallelRun
        ? 'vertical'
        : this.orientationForLine(lineIndex);
      const stations = basePositions[lineIndex].map(({ name, point }, stationIndex) =>
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
        path: '',
        sharedStationNames: this.sharedNamesForLine(names, lineIndex),
        boundaryStationNames: this.boundaryNamesForLine(names, overlapRuns, lineIndex),
      };
    });

    const allStations = lines.flatMap((line) => line.stations);
    lines.forEach((line) => {
      line.path = this.buildPath(line.stations, allStations);
    });

    const transfers = this.findTransfers(names, lines, overlapRuns);
    this.alignStationTicks(lines, transfers, allStations);
    this.placeLabels(lines, transfers);

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

  private horizontalBranchSide(
    branchNames: string[],
    anchor: Point,
    spacing: number,
    occupiedLines: Array<Array<{ name: string; point: Point }>>,
  ): -1 | 1 {
    const collides = (side: -1 | 1, index: number, name: string): boolean => {
        const candidate = {
          x: anchor.x + side * (index + 1) * spacing,
          y: anchor.y,
        };
        return occupiedLines.some((line) =>
          line.some((station) =>
            station.name !== name &&
            this.isSamePoint(station.point, candidate),
          ),
        );
    };

    for (let index = 0; index < branchNames.length; index++) {
      const collidesLeft = collides(-1, index, branchNames[index]);
      const collidesRight = collides(1, index, branchNames[index]);
      if (collidesLeft !== collidesRight) return collidesLeft ? 1 : -1;
    }
    return -1;
  }

  private avoidStationCollisions(
    stations: Array<{ name: string; point: Point }>,
    occupiedLines: Array<Array<{ name: string; point: Point }>>,
    sharedNames: Set<string>,
  ): void {
    stations.forEach((station, index) => {
      if (index === 0 || sharedNames.has(station.name)) return;

      const previous = stations[index - 1];
      const distance = Math.hypot(
        station.point.x - previous.point.x,
        station.point.y - previous.point.y,
      );
      if (distance === 0) return;

      const lineBeforeStation = stations.slice(0, index);
      const occupied = [...occupiedLines, lineBeforeStation];
      if (!this.isPointOccupied(station.point, occupied)) return;

      const horizontal = Math.abs(station.point.x - previous.point.x) >=
        Math.abs(station.point.y - previous.point.y);
      const direction = horizontal
        ? { x: Math.sign(station.point.x - previous.point.x) || 1, y: 0 }
        : { x: 0, y: Math.sign(station.point.y - previous.point.y) || 1 };
      const alternatives = horizontal
        ? [
            { x: -direction.x, y: 0 },
            { x: 0, y: -1 },
            { x: 0, y: 1 },
          ]
        : [
            { x: 0, y: -direction.y },
            { x: 1, y: 0 },
            { x: -1, y: 0 },
          ];
      const replacement = alternatives
        .map((offset) => ({
          x: previous.point.x + offset.x * distance,
          y: previous.point.y + offset.y * distance,
        }))
        .find((candidate) => !this.isPointOccupied(candidate, occupied));

      if (replacement) station.point = replacement;
    });
  }

  private isPointOccupied(
    point: Point,
    lines: Array<Array<{ name: string; point: Point }>>,
  ): boolean {
    return lines.some((line) =>
      line.some((station) => this.isSamePoint(station.point, point)) ||
      line.slice(1).some((station, index) =>
        this.isPointStrictlyOnSegment(point, line[index].point, station.point),
      ),
    );
  }

  private orientationForLine(lineIndex: number): 'horizontal' | 'vertical' {
    return lineIndex === 0 || lineIndex % 2 === 0
      ? 'horizontal'
      : 'vertical';
  }

  private placeStation(
    name: string,
    point: Point,
    index: number,
    stationCount: number,
    orientation: 'horizontal' | 'vertical',
  ): PlacedStation {
    const terminal = index === 0 || index === stationCount - 1;
    let tick: StationTick;

    if (orientation === 'horizontal') {
      tick = terminal
        ? { x1: point.x, y1: point.y - 12, x2: point.x, y2: point.y + 12 }
        : { x1: point.x, y1: point.y - 12, x2: point.x, y2: point.y };
    } else {
      tick = terminal
        ? { x1: point.x - 12, y1: point.y, x2: point.x + 12, y2: point.y }
        : { x1: point.x, y1: point.y, x2: point.x + 12, y2: point.y };
    }

    return {
      name,
      x: point.x,
      y: point.y,
      terminus: terminal,
      tick,
      label: {
        transform: `translate(${this.format(point.x)} ${this.format(point.y - 34)})`,
        anchor: orientation === 'horizontal' ? 'middle' : 'start',
      },
    };
  }

  private findOverlapRuns(names: string[][]): OverlapRun[] {
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

          if (length >= 2) {
            const existing = runs.find((run) =>
              run.names.length === length &&
              run.names.every((name, index) =>
                name === names[first][firstIndex + index],
              ),
            );
            if (existing) {
              if (!existing.lineIndices.includes(first)) existing.lineIndices.push(first);
              if (!existing.lineIndices.includes(second)) existing.lineIndices.push(second);
            } else {
              runs.push({
                names: names[first].slice(firstIndex, firstIndex + length),
                lineIndices: [first, second],
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

  private placeParallelRuns(
    basePositions: Array<Array<{ name: string; point: Point }>>,
    runs: OverlapRun[],
  ): void {
    const lineOffsets = basePositions.map(() => ({ x: 0, y: 0 }));

    runs.forEach((run) => {
      const firstLine = basePositions[run.lineIndices[0]];
      const runStart = firstLine.find((item) => item.name === run.names[0])!.point;
      const runEnd = firstLine.find(
        (item) => item.name === run.names[run.names.length - 1],
      )!.point;
      const dx = runEnd.x - runStart.x;
      const dy = runEnd.y - runStart.y;
      const length = Math.hypot(dx, dy);
      const normal = length > 0
        ? { x: -dy / length, y: dx / length }
        : this.orientationForLine(run.lineIndices[0]) === 'horizontal'
          ? { x: 0, y: 1 }
          : { x: 1, y: 0 };

      run.lineIndices.forEach((lineIndex, rank) => {
        const offset =
          (rank - (run.lineIndices.length - 1) / 2) * this.parallelGap;
        lineOffsets[lineIndex].x += normal.x * offset;
        lineOffsets[lineIndex].y += normal.y * offset;
      });
    });

    basePositions.forEach((stations, lineIndex) => {
      stations.forEach(({ point }) => {
        point.x += lineOffsets[lineIndex].x;
        point.y += lineOffsets[lineIndex].y;
      });
    });
  }

  private buildPath(
    stations: PlacedStation[],
    allStations: PlacedStation[] = stations,
  ): string {
    if (stations.length === 0) return '';
    let path = `M ${this.format(stations[0].x)} ${this.format(stations[0].y)}`;

    for (let index = 1; index < stations.length; index++) {
      const from = stations[index - 1];
      const to = stations[index];
      const routePoints = this.routeSegment(from, to, allStations);
      routePoints.forEach((point) => {
        path += ` L ${this.format(point.x)} ${this.format(point.y)}`;
      });
    }
    return path;
  }

  private routeSegment(
    from: { x: number; y: number },
    to: { x: number; y: number },
    forbiddenStations: Point[],
  ): Point[] {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (
      (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) &&
      !this.routeCrossesStation(from, [to], forbiddenStations)
    ) {
      return [to];
    }

    const horizontalFirst = { x: to.x, y: from.y };
    const verticalFirst = { x: from.x, y: to.y };
    const routes = Math.abs(dx) >= Math.abs(dy)
      ? [[horizontalFirst, to], [verticalFirst, to]]
      : [[verticalFirst, to], [horizontalFirst, to]];
    return routes.find((route) =>
      !this.routeCrossesStation(from, route, forbiddenStations),
    ) ?? routes[0];
  }

  private routeCrossesStation(
    from: Point,
    route: Point[],
    forbiddenStations: Point[],
  ): boolean {
    const to = route[route.length - 1];
    const points = [from, ...route];
    return forbiddenStations.some((station) => {
      if (this.isSamePoint(station, from) || this.isSamePoint(station, to)) {
        return false;
      }
      if (route.slice(0, -1).some((point) => this.isSamePoint(station, point))) {
        return true;
      }
      return points.slice(1).some((end, index) =>
        this.isPointStrictlyOnSegment(station, points[index], end),
      );
    });
  }

  private isPointStrictlyOnSegment(
    point: Point,
    start: Point,
    end: Point,
  ): boolean {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const cross = (point.x - start.x) * dy - (point.y - start.y) * dx;
    if (Math.abs(cross) > 0.01) return false;
    const dot = (point.x - start.x) * dx + (point.y - start.y) * dy;
    const lengthSquared = dx * dx + dy * dy;
    return dot > 0.01 && dot < lengthSquared - 0.01;
  }

  private isSamePoint(a: Point, b: Point): boolean {
    return Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
  }

  private alignStationTicks(
    lines: MetroLineLayout[],
    transfers: TransferStation[],
    allStations: PlacedStation[],
  ): void {
    const transferNames = new Set(transfers.map((transfer) => transfer.name));

    lines.forEach((line) => {
      line.stations.forEach((station, index) => {
        if (transferNames.has(station.name)) return;
        const previous = line.stations[index - 1];
        const next = line.stations[index + 1];
        const tangent = this.tangentAtStation(
          previous,
          station,
          next,
          allStations,
        );

        let normalX = -tangent.y;
        let normalY = tangent.x;
        if (Math.abs(tangent.x) >= 0.99) {
          normalX = 0;
          normalY = -1;
        } else if (Math.abs(tangent.y) >= 0.99) {
          normalX = 1;
          normalY = 0;
        }

        station.tick = station.terminus
          ? {
              x1: station.x - normalX * 12,
              y1: station.y - normalY * 12,
              x2: station.x + normalX * 12,
              y2: station.y + normalY * 12,
            }
          : {
              x1: station.x,
              y1: station.y,
              x2: station.x + normalX * 12,
              y2: station.y + normalY * 12,
            };
      });
    });
  }

  private tangentAtStation(
    previous: PlacedStation | undefined,
    station: PlacedStation,
    next: PlacedStation | undefined,
    allStations: PlacedStation[],
  ): Point {
    let x = 0;
    let y = 0;
    let fallback: Point | undefined;
    const neighbors: Point[] = [];
    if (previous) {
      const incomingRoute = this.routeSegment(previous, station, allStations);
      neighbors.push(
        incomingRoute.length > 1
          ? incomingRoute[incomingRoute.length - 2]
          : previous,
      );
    }
    if (next) {
      const outgoingRoute = this.routeSegment(station, next, allStations);
      neighbors.push(outgoingRoute[0] ?? next);
    }

    neighbors.forEach((neighbor) => {
      const dx = neighbor.x - station.x;
      const dy = neighbor.y - station.y;
      const length = Math.hypot(dx, dy);
      if (length > 0) {
        const direction = { x: dx / length, y: dy / length };
        fallback ??= direction;
        x += direction.x;
        y += direction.y;
      }
    });
    const length = Math.hypot(x, y);
    return length === 0
      ? fallback ?? { x: 1, y: 0 }
      : { x: x / length, y: y / length };
  }

  private sharedNamesForLine(names: string[][], lineIndex: number): string[] {
    return names[lineIndex].filter((name) =>
      names.some((stations, otherIndex) =>
        otherIndex !== lineIndex && stations.includes(name),
      ),
    );
  }

  private boundaryNamesForLine(
    names: string[][],
    runs: OverlapRun[],
    lineIndex: number,
  ): string[] {
    const boundaries = new Set<string>();
    runs.forEach((run) => {
      if (!run.lineIndices.includes(lineIndex)) return;
      boundaries.add(run.names[0]);
      boundaries.add(run.names[run.names.length - 1]);
    });
    return [...boundaries];
  }

  private findTransfers(
    names: string[][],
    lines: MetroLineLayout[],
    runs: OverlapRun[],
  ): TransferStation[] {
    const transferNames = new Set<string>();

    names.forEach((stations) => {
      stations.forEach((name) => {
        const lineCount = names.filter((line) => line.includes(name)).length;
        if (lineCount < 2) return;
        if (lineCount >= 3) {
          transferNames.add(name);
          return;
        }
        const parallelRun = runs.find(
          (run) => run.names.includes(name) && run.names.length >= 2,
        );
        if (!parallelRun) {
          transferNames.add(name);
        } else if (
          name === parallelRun.names[0] ||
          name === parallelRun.names[parallelRun.names.length - 1]
        ) {
          transferNames.add(name);
        }
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

  private rightEdge(names: string[][], spacing: number): number {
    return Math.max(
      0,
      (names[0].length - 1) * spacing,
    );
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

  private placeLabels(
    lines: MetroLineLayout[],
    transfers: TransferStation[],
  ): void {
    const transferNames = new Set(transfers.map((transfer) => transfer.name));
    const occupied: Array<{ x: number; y: number; width: number; height: number }> = [];

    lines.forEach((line) => {
      line.stations.forEach((station) => {
        if (transferNames.has(station.name)) return;
        if (line.sharedStationNames.includes(station.name) &&
            line.orientation === 'vertical') return;

        const width = station.name.length * 8;
        const candidates = line.orientation === 'horizontal'
          ? [
              { x: station.x - width / 2, y: station.y - 46 },
              { x: station.x - width - 8, y: station.y - 46 },
              { x: station.x + 8, y: station.y - 46 },
            ]
          : [
              { x: station.x + 18, y: station.y - 10 },
              { x: station.x - width - 18, y: station.y - 10 },
              { x: station.x + 18, y: station.y + 12 },
            ];

        const candidate = candidates.find((position) =>
          occupied.every((box) =>
            position.x + width < box.x ||
            position.x > box.x + box.width ||
            position.y + 18 < box.y ||
            position.y > box.y + box.height,
          ),
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

  private format(value: number): string {
    return value.toFixed(2);
  }
}
