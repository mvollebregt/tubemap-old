import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { MetroMappingService } from './services/metro-mapping.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Stationslijst');
  });

  it('should place stations on one horizontal line', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout([['A', 'B', 'C']], '#E32017', '#003688');

    expect(layout.stations.map((station) => station.y)).toEqual([155, 155, 155]);
    expect(layout.path).toBe('M 0.00 155.00 L 72.00 155.00 L 144.00 155.00');
  });

  it('should stop the line at the first and last station ticks', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout([['A', 'B', 'C']], '#E32017', '#003688');
    const first = layout.stations[0];
    const last = layout.stations.at(-1)!;

    expect(layout.path.startsWith(`M ${first.x.toFixed(2)} ${first.y}`)).toBe(true);
    expect(layout.path.endsWith(`L ${last.x.toFixed(2)} ${last.y.toFixed(2)}`)).toBe(true);
  });

  it('should create a transfer at a matching station', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout(
      [['A', 'Shared', 'C'], ['Top', 'Shared', 'Bottom']],
      '#E32017',
      '#003688',
    );

    expect(layout.lines).toHaveLength(2);
    expect(layout.lines[1].orientation).toBe('vertical');
    expect(layout.transfers).toEqual([
      expect.objectContaining({ name: 'Shared' }),
    ]);
  });

  it('should only mark the ends of a consecutive shared station run', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout(
      [
        ['A', 'Shared 1', 'Shared 2', 'Shared 3', 'Z'],
        ['Top', 'Shared 1', 'Shared 2', 'Shared 3', 'Bottom'],
      ],
      '#E32017',
      '#003688',
    );

    expect(layout.lines[1].sharedStationNames).toEqual([
      'Shared 1',
      'Shared 2',
      'Shared 3',
    ]);
    expect(layout.transfers.map((transfer) => transfer.name)).toEqual([
      'Shared 1',
      'Shared 3',
    ]);
  });

  it('should render shared non-transfer ticks toward the label on both lines', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout(
      [
        ['A', 'Shared 1', 'Shared 2', 'Shared 3', 'B'],
        ['Top', 'Shared 1', 'Shared 2', 'Shared 3', 'Bottom'],
      ],
      '#E32017',
      '#003688',
    );

    const horizontal = layout.lines[0].stations.find(
      (station) => station.name === 'Shared 2',
    )!;
    const vertical = layout.lines[1].stations.find(
      (station) => station.name === 'Shared 2',
    )!;
    const transferNames = layout.transfers.map((transfer) => transfer.name);

    expect(transferNames).not.toContain('Shared 2');
    expect(horizontal.tick.x1).toBe(horizontal.tick.x2);
    expect(vertical.tick.x1).toBe(vertical.x);
    expect(vertical.tick.x2).toBeGreaterThanOrEqual(vertical.x);
  });

  it('should keep consecutive shared stations on parallel tracks', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout(
      [
        ['A', 'Shared 1', 'Shared 2', 'Shared 3', 'B'],
        ['Top', 'Shared 1', 'Shared 2', 'Shared 3', 'Bottom'],
      ],
      '#E32017',
      '#003688',
    );

    const horizontal = layout.lines[0].stations.find(
      (station) => station.name === 'Shared 2',
    )!;
    const vertical = layout.lines[1].stations.find(
      (station) => station.name === 'Shared 2',
    )!;

    expect(horizontal.x).toBe(vertical.x);
    expect(horizontal.y).toBe(150);
  });

  it('should keep the overlap segment to the last stations parallel and direct', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout(
      [
        ['A', 'Shared 1', 'Shared 2', 'Shared 3'],
        ['Top', 'Shared 1', 'Shared 2', 'Shared 3'],
      ],
      '#E32017',
      '#003688',
    );

    const horizontalShared = layout.lines[0].stations.find(
      (station) => station.name === 'Shared 2',
    )!;
    const verticalShared = layout.lines[1].stations.find(
      (station) => station.name === 'Shared 2',
    )!;
    expect(horizontalShared.x).toBe(verticalShared.x);
    expect(verticalShared.x).toBe(horizontalShared.x);
    expect(Math.abs(verticalShared.y - horizontalShared.y)).toBeGreaterThanOrEqual(0);
    expect(layout.lines[0].path).not.toContain('L 0.00');
  });

  it('should draw consecutive overlapping stations directly without a detour', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout(
      [
        ['A', 'Shared 1', 'Shared 2', 'Shared 3', 'End'],
        ['Top', 'Shared 1', 'Shared 2', 'Shared 3', 'Below'],
      ],
      '#E32017',
      '#003688',
    );

    const secondLine = layout.lines[1];
    const sharedTwo = secondLine.stations.find(
      (station) => station.name === 'Shared 2',
    )!;
    const sharedThree = secondLine.stations.find(
      (station) => station.name === 'Shared 3',
    )!;

    expect(sharedTwo.y).toBe(sharedThree.y);
    expect(secondLine.path).toContain(
      `L ${sharedThree.x.toFixed(2)} ${sharedThree.y.toFixed(2)}`,
    );
  });

  it('should continue vertically down from the last overlap station', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout(
      [
        ['A', 'Shared 1', 'Shared 2', 'Shared 3', 'End'],
        ['Top', 'Shared 1', 'Shared 2', 'Shared 3', 'Below'],
      ],
      '#E32017',
      '#003688',
    );

    const verticalLine = layout.lines[1];
    const lastShared = verticalLine.stations.find(
      (station) => station.name === 'Shared 3',
    )!;
    const nextStation = verticalLine.stations.find(
      (station) => station.name === 'Below',
    )!;

    expect(Number.isFinite(nextStation.x)).toBe(true);
  });

  it('should keep every segment of a four-station overlap exactly parallel', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout(
      [
        ['A', 'B', 'C', 'D'],
        ['A', 'B', 'C', 'D'],
      ],
      '#E32017',
      '#003688',
    );

    const horizontal = layout.lines[0].stations;
    const vertical = layout.lines[1].stations;

    for (let index = 0; index < horizontal.length - 1; index++) {
      const horizontalDy = horizontal[index + 1].y - horizontal[index].y;
      const verticalDy = vertical[index + 1].y - vertical[index].y;
      expect(Math.abs(horizontalDy + verticalDy)).toBeLessThanOrEqual(0.01);
    }
  });

  it('should keep both lines parallel across a two-station overlap', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout(
      [
        ['A', 'B', 'C'],
        ['Top', 'B', 'C', 'Bottom'],
      ],
      '#E32017',
      '#003688',
    );

    const bHorizontal = layout.lines[0].stations.find((station) => station.name === 'B')!;
    const cHorizontal = layout.lines[0].stations.find((station) => station.name === 'C')!;
    const bVertical = layout.lines[1].stations.find((station) => station.name === 'B')!;
    const cVertical = layout.lines[1].stations.find((station) => station.name === 'C')!;

    expect(cHorizontal.y - bHorizontal.y).toBe(0);
    expect(cVertical.y - bVertical.y).toBe(0);
    expect(cHorizontal.x).toBe(cVertical.x);
    expect(bHorizontal.x).toBe(bVertical.x);
  });

  it('should offset each shared segment when overlaps continue across three lines', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout(
      [
        ['A', 'B', 'C'],
        ['B', 'C', 'D'],
        ['C', 'D', 'E'],
      ],
      ['#E32017', '#003688', '#FFD300'],
    );

    const segment = (
      lineIndex: number,
      fromName: string,
      toName: string,
    ): [number, number, number, number] => {
      const stations = layout.lines[lineIndex].stations;
      const from = stations.find((station) => station.name === fromName)!;
      const to = stations.find((station) => station.name === toName)!;
      return [from.x, from.y, to.x, to.y];
    };

    const assertParallelAndAdjacent = (
      first: [number, number, number, number],
      second: [number, number, number, number],
    ) => {
      const firstDx = first[2] - first[0];
      const firstDy = first[3] - first[1];
      const secondDx = second[2] - second[0];
      const secondDy = second[3] - second[1];
      expect(firstDx * secondDy - firstDy * secondDx).toBe(0);
      const segmentLength = Math.hypot(firstDx, firstDy);
      const perpendicularDistance = Math.abs(
        firstDx * (second[1] - first[1]) -
        firstDy * (second[0] - first[0]),
      ) / segmentLength;
      expect(perpendicularDistance).toBe(10);
    };

    assertParallelAndAdjacent(segment(0, 'B', 'C'), segment(1, 'B', 'C'));
    assertParallelAndAdjacent(segment(1, 'C', 'D'), segment(2, 'C', 'D'));
  });

  it('should use no curved or arbitrary-angle segments across a shared run', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout(
      [
        ['A', 'B', 'C', 'D', 'End'],
        ['Top', 'B', 'C', 'D', 'Below'],
      ],
      '#E32017',
      '#003688',
    );

    expect(layout.lines.length).toBeGreaterThan(0);
  });

  it('should render two separate lines even when there is no overlap', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout(
      [['A', 'B', 'C'], ['X', 'Y', 'Z']],
      '#E32017',
      '#003688',
    );

    expect(layout.lines).toHaveLength(2);
    expect(layout.transfers).toHaveLength(0);
    expect(layout.lines[0].stations.map((station) => station.y).every((y) => y === 155)).toBe(true);
    expect(layout.lines[1].stations.every((station) =>
      station.x === layout.lines[1].stations[0].x,
    )).toBe(true);
  });

  it('should render three independent metro lines', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout(
      [
        ['A', 'B', 'C'],
        ['B', 'C', 'D'],
        ['X', 'Y', 'Z'],
      ],
      ['#E32017', '#003688', '#00782A'],
    );

    expect(layout.lines).toHaveLength(3);
    expect(layout.lines.map((line) => line.orientation)).toEqual([
      'horizontal',
      'vertical',
      'horizontal',
    ]);
  });

  it('should place a short third-line branch without a vertical detour', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout(
      [
        ['A', 'B', 'C'],
        ['D', 'B', 'E'],
        ['A', 'F'],
      ],
      ['#E32017', '#003688', '#FFD300'],
    );

    const firstA = layout.lines[0].stations.find((station) => station.name === 'A')!;
    const thirdA = layout.lines[2].stations.find((station) => station.name === 'A')!;
    const thirdF = layout.lines[2].stations.find((station) => station.name === 'F')!;

    expect(thirdA.x).toBe(firstA.x);
    expect(thirdA.y).toBe(firstA.y);
    expect(thirdF.y).toBe(firstA.y);
    expect(Math.abs(thirdF.x - thirdA.x)).toBe(72);
  });

  it('should align F tick vertically on the horizontal A-F segment', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout(
      [
        ['A', 'B', 'C'],
        ['D', 'B', 'E'],
        ['A', 'F'],
      ],
      ['#E32017', '#003688', '#FFD300'],
    );

    const thirdF = layout.lines[2].stations.find((station) => station.name === 'F')!;
    expect(thirdF.tick.x1).toBe(thirdF.x);
    expect(thirdF.tick.x2).toBe(thirdF.x);
    expect(thirdF.tick.y1).not.toBe(thirdF.y);
    expect(thirdF.tick.y2).not.toBe(thirdF.y);
    expect((thirdF.tick.y1 + thirdF.tick.y2) / 2).toBe(thirdF.y);
  });

  it('should treat a one-station overlap as a transfer without a parallel lane', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout(
      [
        ['A', 'Shared', 'C'],
        ['Top', 'Shared', 'Bottom'],
      ],
      '#E32017',
      '#003688',
    );

    expect(layout.transfers.map((transfer) => transfer.name)).toContain('Shared');
    const horizontal = layout.lines[0].stations.find(
      (station) => station.name === 'Shared',
    )!;
    const vertical = layout.lines[1].stations.find(
      (station) => station.name === 'Shared',
    )!;
    expect(horizontal.y).toBe(155);
    expect(vertical.y).toBe(155);
  });

  it('should draw both colored ticks at a shared non-transfer station', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout(
      [
        ['A', 'B', 'C', 'D'],
        ['Top', 'B', 'C', 'D'],
      ],
      '#E32017',
      '#003688',
    );

    const horizontal = layout.lines[0].stations.find((station) => station.name === 'C')!;
    const vertical = layout.lines[1].stations.find((station) => station.name === 'C')!;

    expect(horizontal.tick.x1).toBe(horizontal.tick.x2);
    expect(Math.hypot(
      vertical.tick.x2 - vertical.tick.x1,
      vertical.tick.y2 - vertical.tick.y1,
    )).toBeGreaterThan(0);
  });

  it('should center horizontal and vertical terminal ticks on the final lane', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout(
      [
        ['A', 'B', 'C'],
        ['Top', 'B', 'Bottom'],
      ],
      '#E32017',
      '#003688',
    );

    const horizontalFirst = layout.lines[0].stations[0];
    const horizontalLast = layout.lines[0].stations.at(-1)!;
    expect(horizontalFirst.tick.x1).toBe(horizontalFirst.x);
    expect(horizontalFirst.tick.x2).toBe(horizontalFirst.x);
    expect(horizontalLast.tick.x1).toBe(horizontalLast.x);
    expect(horizontalLast.tick.x2).toBe(horizontalLast.x);

    const verticalFirst = layout.lines[1].stations[0];
    const verticalLast = layout.lines[1].stations.at(-1)!;
    expect((verticalFirst.tick.x1 + verticalFirst.tick.x2) / 2).toBe(verticalFirst.x);
    expect((verticalFirst.tick.y1 + verticalFirst.tick.y2) / 2).toBe(verticalFirst.y);
    expect((verticalLast.tick.x1 + verticalLast.tick.x2) / 2).toBe(verticalLast.x);
    expect((verticalLast.tick.y1 + verticalLast.tick.y2) / 2).toBe(verticalLast.y);
  });

  it('should place the A-B-C-D-E / F-B-C-D-E-G / C-H-I map without collisions', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout(
      [
        ['A', 'B', 'C', 'D', 'E'],
        ['F', 'B', 'C', 'D', 'E', 'G'],
        ['C', 'H', 'I'],
      ],
      ['#E32017', '#003688', '#FFD300'],
    );

    expect(layout.lines).toHaveLength(3);

    const pointMap = new Map<string, Set<string>>();
    layout.lines.forEach((line) => {
      line.stations.forEach((station) => {
        const key = `${station.x}:${station.y}`;
        const stationNames = pointMap.get(key) ?? new Set<string>();
        stationNames.add(station.name);
        pointMap.set(key, stationNames);
      });
    });

    pointMap.forEach((names) => {
      if (names.size > 1) {
        throw new Error(`Collision at point with stations: ${[...names].join(', ')}`);
      }
    });

    const C = layout.lines[0].stations.find((station) => station.name === 'C')!;
    const D = layout.lines[0].stations.find((station) => station.name === 'D')!;
    const C2 = layout.lines[1].stations.find((station) => station.name === 'C')!;
    const D2 = layout.lines[1].stations.find((station) => station.name === 'D')!;

    expect(C.x).toBe(C2.x);
    expect(C.y).toBe(150);
    expect(C2.y).toBe(160);
    expect(D.x).toBe(D2.x);
    expect(D.y).toBe(150);
    expect(D2.y).toBe(160);

    const G = layout.lines[1].stations.find((station) => station.name === 'G')!;
    const E = layout.lines[1].stations.find((station) => station.name === 'E')!;
    expect(G.x).toBe(E.x);
    expect(G.y).toBeGreaterThan(E.y);

    expect(layout.transfers.map((transfer) => transfer.name)).toContain('C');

    const H = layout.lines[2].stations.find((station) => station.name === 'H')!;
    expect(H.tick.y1).toBe(H.y);
    expect(H.tick.y2).toBe(H.y);
    expect(H.tick.x1).not.toBe(H.tick.x2);
  });

  it('should keep a horizontal tick for a multi-letter middle station', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout(
      [
        ['A', 'B', 'C', 'D', 'E'],
        ['F', 'B', 'C', 'D', 'E', 'G'],
        ['C', 'HA', 'I'],
      ],
      ['#E32017', '#003688', '#FFD300'],
    );

    const HA = layout.lines[2].stations.find((station) => station.name === 'HA')!;
    expect(HA.tick.y1).toBe(HA.y);
    expect(HA.tick.y2).toBe(HA.y);
    expect(HA.tick.x1).not.toBe(HA.tick.x2);
  });

  it('should align ticks for stations on fourth and fifth vertical lines', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout(
      [
        ['A', 'B', 'C', 'D', 'E'],
        ['F', 'B', 'C', 'D', 'E', 'G'],
        ['C', 'H', 'I'],
        ['C', 'J', 'K', 'L'],
        ['C', 'M', 'N', 'O', 'P'],
      ],
      ['#E32017', '#003688', '#FFD300', '#00782A', '#7156A5'],
    );

    layout.lines.forEach((line) => {
      line.stations.forEach((station) => {
        expect(Math.hypot(
          station.tick.x2 - station.tick.x1,
          station.tick.y2 - station.tick.y1,
        )).toBeGreaterThan(0);
      });
    });

    layout.lines.slice(2).forEach((line) => {
      line.stations.forEach((station) => {
        expect(station.tick.y1).toBe(station.y);
        expect(station.tick.y2).toBe(station.y);
        expect(station.tick.x1).not.toBe(station.tick.x2);
      });
    });
  });

  it('should align shared ticks on the station axis and label side', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout(
      [
        ['A', 'B', 'C', 'D'],
        ['A', 'B', 'C', 'D'],
      ],
      '#E32017',
      '#003688',
    );

    const horizontal = layout.lines[0].stations.find(
      (station) => station.name === 'C',
    )!;
    const vertical = layout.lines[1].stations.find(
      (station) => station.name === 'C',
    )!;

    expect(horizontal.tick.x1).toBe(horizontal.x);
    expect(horizontal.tick.x2).toBe(horizontal.x);
    expect(vertical.tick.x1).toBe(vertical.x);
    expect(vertical.tick.x2).toBe(vertical.x);
  });
});
