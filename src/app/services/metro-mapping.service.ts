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
      if (orientation === 'vertical' && startsInParallelRun) return;
      this.avoidStationCollisions(
        stations,
        basePositions.slice(0, lineIndex),
        new Set(this.sharedNamesForLine(names, lineIndex)),
        orientation,
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
    this.alignStationTicks(lines, transfers);
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
    orientation: 'horizontal' | 'vertical',
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
      const collides = orientation === 'horizontal'
        ? this.isPointOccupied(station.point, occupied)
        : this.isStationOccupied(station.point, occupied);
      if (!collides) return;

      const preferredDirection = this.directionBetween(previous.point, station.point);
      const diagonalDistance = Math.round(distance / Math.SQRT2);
      const candidates = [
        { x: distance, y: 0 },
        { x: diagonalDistance, y: diagonalDistance },
        { x: 0, y: distance },
        { x: -diagonalDistance, y: diagonalDistance },
        { x: -distance, y: 0 },
        { x: -diagonalDistance, y: -diagonalDistance },
        { x: 0, y: -distance },
        { x: diagonalDistance, y: -diagonalDistance },
      ]
        .map((direction) => ({
          x: previous.point.x + direction.x,
          y: previous.point.y + direction.y,
        }))
        .filter((candidate) => !this.isPointOccupied(candidate, occupied));
      const next = stations[index + 1]?.point;
      const replacement = candidates.reduce<Point | undefined>((best, candidate) => {
        if (!best) return candidate;
        return this.stationLayoutEnergy(
          candidate,
          station.point,
          previous.point,
          next,
          occupied,
          distance,
        ) < this.stationLayoutEnergy(
          best,
          station.point,
          previous.point,
          next,
          occupied,
          distance,
        )
          ? candidate
          : best;
      }, undefined);

      if (replacement) station.point = replacement;
    });
  }

  private stationLayoutEnergy(
    candidate: Point,
    preferred: Point,
    previous: Point,
    next: Point | undefined,
    occupiedLines: Array<Array<{ name: string; point: Point }>>,
    idealLength: number,
  ): number {
    const neighbors = [previous, next].filter((point): point is Point => !!point);
    const edgeStress = neighbors.reduce((stress, neighbor) => {
      const length = Math.hypot(candidate.x - neighbor.x, candidate.y - neighbor.y);
      return stress + (length - idealLength) ** 2;
    }, 0);

    const intendedDirection = this.directionBetween(previous, preferred);
    const candidateDirection = this.directionBetween(previous, candidate);
    const alignment = intendedDirection.x * candidateDirection.x +
      intendedDirection.y * candidateDirection.y;
    const directionalStress = idealLength ** 2 * (1 - alignment) ** 2;
    const repulsion = occupiedLines.reduce((stress, line) =>
      stress + line.reduce((lineStress, station) => {
        const distance = Math.hypot(
          candidate.x - station.point.x,
          candidate.y - station.point.y,
        );
        return lineStress + idealLength ** 4 / Math.max(distance, 1) ** 2;
      }, 0),
    0);

    return edgeStress + directionalStress + repulsion;
  }

  private isStationOccupied(
    point: Point,
    lines: Array<Array<{ name: string; point: Point }>>,
  ): boolean {
    return lines.some((line) =>
      line.some((station) => this.isSamePoint(station.point, point)),
    );
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
    let incomingDirection: Point | undefined;

    for (let index = 1; index < stations.length; index++) {
      const from = stations[index - 1];
      const to = stations[index];
      const routePoints = this.routeSegment(
        from,
        to,
        allStations,
        incomingDirection,
      );
      routePoints.forEach((point) => {
        path += ` L ${this.format(point.x)} ${this.format(point.y)}`;
      });
      const previous = routePoints.length > 1
        ? routePoints[routePoints.length - 2]
        : from;
      incomingDirection = this.directionBetween(previous, to);
    }
    return path;
  }

  private routeSegment(
    from: { x: number; y: number },
    to: { x: number; y: number },
    forbiddenStations: Point[],
    incomingDirection?: Point,
  ): Point[] {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const horizontalFirst = { x: to.x, y: from.y };
    const verticalFirst = { x: from.x, y: to.y };
    const routes: Point[][] = [];
    if (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) {
      routes.push([to]);
    }

    const orthogonalRoutes = Math.abs(dx) >= Math.abs(dy)
      ? [[horizontalFirst, to], [verticalFirst, to]]
      : [[verticalFirst, to], [horizontalFirst, to]];
    routes.push(...orthogonalRoutes);

    if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) {
      const diagonalLength = Math.min(Math.abs(dx), Math.abs(dy));
      const diagonalPoint = {
        x: from.x + Math.sign(dx) * diagonalLength,
        y: from.y + Math.sign(dy) * diagonalLength,
      };
      routes.push([diagonalPoint, to]);

      const axisPoint = Math.abs(dx) > Math.abs(dy)
        ? {
            x: from.x + Math.sign(dx) * (Math.abs(dx) - diagonalLength),
            y: from.y,
          }
        : {
            x: from.x,
            y: from.y + Math.sign(dy) * (Math.abs(dy) - diagonalLength),
          };
      routes.push([axisPoint, to]);
    }

    const validRoutes = routes
      .map((route) => this.compactRoute(from, route))
      .filter((route) =>
        !this.routeCrossesStation(from, route, forbiddenStations),
      );
    if (validRoutes.length === 0) {
      return this.compactRoute(from, routes[0]);
    }
    if (!incomingDirection) return validRoutes[0];

    return validRoutes.reduce((best, route) =>
      this.compareRouteScores(
        this.routeScore(from, route, incomingDirection),
        this.routeScore(from, best, incomingDirection),
      ) < 0
        ? route
        : best,
    );
  }

  private compactRoute(from: Point, route: Point[]): Point[] {
    const compact: Point[] = [];
    let previous = from;
    route.forEach((point) => {
      if (this.isSamePoint(previous, point)) return;
      compact.push(point);
      previous = point;
    });
    return compact.length > 0
      ? compact
      : [route[route.length - 1]];
  }

  private routeScore(
    from: Point,
    route: Point[],
    incomingDirection: Point,
  ): { rightAngleBends: number; totalBends: number } {
    let previousDirection = incomingDirection;
    let rightAngleBends = 0;
    let totalBends = 0;
    let previous = from;
    route.forEach((point) => {
      const direction = this.directionBetween(previous, point);
      const dot = previousDirection.x * direction.x +
        previousDirection.y * direction.y;
      if (dot < 0.999) {
        totalBends++;
        if (Math.abs(dot) <= 0.01) {
          rightAngleBends++;
        }
      }
      previousDirection = direction;
      previous = point;
    });
    return { rightAngleBends, totalBends };
  }

  private compareRouteScores(
    first: { rightAngleBends: number; totalBends: number },
    second: { rightAngleBends: number; totalBends: number },
  ): number {
    return first.totalBends - second.totalBends ||
      first.rightAngleBends - second.rightAngleBends;
  }

  private directionBetween(from: Point, to: Point): Point {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    return length === 0
      ? { x: 0, y: 0 }
      : { x: dx / length, y: dy / length };
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
  ): void {
    const transferNames = new Set(transfers.map((transfer) => transfer.name));

    lines.forEach((line) => {
      const pathPoints = this.pathPoints(line.path);
      const stationPathIndices = this.stationPathIndices(line.stations, pathPoints);
      const stationByPathIndex = new Map(
        stationPathIndices.map((pathIndex, index) => [
          pathIndex,
          line.stations[index],
        ]),
      );
      const orderedStations = line.stations
        .map((station, index) => ({
          station,
          pathIndex: stationPathIndices[index],
        }))
        .sort(({ pathIndex: first }, { pathIndex: second }) => {
          const firstCorner = this.isPathCorner(pathPoints, first);
          const secondCorner = this.isPathCorner(pathPoints, second);
          return Number(firstCorner) - Number(secondCorner);
        });

      orderedStations.forEach(({ station, pathIndex }) => {
        if (transferNames.has(station.name)) return;
        const previous = pathPoints[pathIndex - 1];
        const next = pathPoints[pathIndex + 1];
        const corner = this.isPathCorner(pathPoints, pathIndex);
        const previousStation = stationByPathIndex.get(pathIndex - 1);
        const nextStation = stationByPathIndex.get(pathIndex + 1);
        const previousSupported = corner &&
          previous &&
          previousStation &&
          this.tickIsPerpendicularToSegment(
            previousStation.tick,
            previous,
            station,
          );
        const nextSupported = corner &&
          next &&
          nextStation &&
          this.tickIsPerpendicularToSegment(
            nextStation.tick,
            station,
            next,
          );
        const tangent = corner
          ? this.directionBetween(
              station,
              previousSupported || !nextSupported ? previous! : next!,
            )
          : this.tangentAtStation(previous, station, next);

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

  private isPathCorner(pathPoints: Point[], pathIndex: number): boolean {
    const previous = pathPoints[pathIndex - 1];
    const station = pathPoints[pathIndex];
    const next = pathPoints[pathIndex + 1];
    if (!previous || !next) return false;
    const incoming = this.directionBetween(previous, station);
    const outgoing = this.directionBetween(station, next);
    return Math.abs(
      incoming.x * outgoing.y - incoming.y * outgoing.x,
    ) > 0.01 || incoming.x * outgoing.x + incoming.y * outgoing.y < 0.99;
  }

  private tickIsPerpendicularToSegment(
    tick: StationTick,
    start: Point,
    end: Point,
  ): boolean {
    const tickDirection = this.directionBetween(
      { x: tick.x1, y: tick.y1 },
      { x: tick.x2, y: tick.y2 },
    );
    const segmentDirection = this.directionBetween(start, end);
    return Math.abs(
      tickDirection.x * segmentDirection.x +
      tickDirection.y * segmentDirection.y,
    ) < 0.01;
  }

  private pathPoints(path: string): Point[] {
    return [...path.matchAll(/(?:M|L)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)]
      .map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
  }

  private stationPathIndices(
    stations: PlacedStation[],
    pathPoints: Point[],
  ): number[] {
    let searchFrom = 0;
    return stations.map((station) => {
      const index = pathPoints.findIndex((point, pointIndex) =>
        pointIndex >= searchFrom && this.isSamePoint(point, station),
      );
      if (index < 0) {
        throw new Error(`Station "${station.name}" is missing from its line path.`);
      }
      searchFrom = index + 1;
      return index;
    });
  }

  private tangentAtStation(
    previous: Point | undefined,
    station: PlacedStation,
    next: Point | undefined,
  ): Point {
    let x = 0;
    let y = 0;
    let fallback: Point | undefined;
    [previous, next].forEach((neighbor) => {
      if (!neighbor) return;
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
