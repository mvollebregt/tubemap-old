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
    expect(layout.path).toBe('M 0.00 155 L 144.00 155');
  });

  it('should stop the line at the first and last station ticks', () => {
    const mapping = new MetroMappingService();
    const layout = mapping.layout([['A', 'B', 'C']], '#E32017', '#003688');
    const first = layout.stations[0];
    const last = layout.stations.at(-1)!;

    expect(layout.path.startsWith(`M ${first.x.toFixed(2)} ${first.y}`)).toBe(true);
    expect(layout.path.endsWith(`L ${last.x.toFixed(2)} ${last.y}`)).toBe(true);
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
    expect(horizontal.tick.y1).toBeLessThan(horizontal.y);
    expect(horizontal.tick.y2).toBe(horizontal.y);
    expect(vertical.tick.x1).toBe(vertical.x);
    expect(vertical.tick.x2).toBeGreaterThan(vertical.x);
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

    expect(horizontal.y).toBeLessThan(vertical.y);
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
    expect(horizontalShared.y).not.toBe(verticalShared.y);
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

    expect(sharedTwo.y).toBe(160);
    expect(sharedThree.y).toBe(160);
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

    expect(nextStation.x).toBe(lastShared.x);
    expect(nextStation.y).toBeGreaterThan(lastShared.y);
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
    expect(cHorizontal.y).toBe(150);
    expect(cVertical.y).toBe(160);
    expect(cVertical.y - cHorizontal.y).toBe(10);
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

    for (const line of layout.lines) {
      const stationYs = line.stations.map((station) => station.y);
      const stationXs = line.stations.map((station) => station.x);
      for (let index = 1; index < line.stations.length; index++) {
        const dx = Math.abs(stationXs[index] - stationXs[index - 1]);
        const dy = Math.abs(stationYs[index] - stationYs[index - 1]);
        expect(dx === 0 || dy === 0 || dx === dy).toBe(true);
      }
    }
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
});
