import { MetroMappingService } from './metro-mapping.service';

describe('MetroMappingService with multiple lines', () => {
  const station = (
    layout: ReturnType<MetroMappingService['layout']>,
    lineIndex: number,
    name: string,
  ) => layout.lines[lineIndex].stations.find((item) => item.name === name)!;

  const expectParallelSegments = (
    firstFrom: { x: number; y: number },
    firstTo: { x: number; y: number },
    secondFrom: { x: number; y: number },
    secondTo: { x: number; y: number },
    expectedDistance?: number,
  ) => {
    const dx = firstTo.x - firstFrom.x;
    const dy = firstTo.y - firstFrom.y;
    const otherDx = secondTo.x - secondFrom.x;
    const otherDy = secondTo.y - secondFrom.y;

    expect(dx * otherDy - dy * otherDx).toBeCloseTo(0, 8);

    const distance = Math.abs(
      dx * (secondFrom.y - firstFrom.y) -
      dy * (secondFrom.x - firstFrom.x),
    ) / Math.hypot(dx, dy);
    if (expectedDistance === undefined) {
      expect(distance).toBeGreaterThan(0);
    } else {
      expect(distance).toBeCloseTo(expectedDistance, 8);
    }
  };

  it('keeps every segment of a four-line shared run on a separate parallel track', () => {
    const layout = new MetroMappingService().layout(
      [
        ['A', 'B', 'C', 'D', 'E'],
        ['F', 'B', 'C', 'D', 'G'],
        ['H', 'B', 'C', 'D', 'I'],
        ['J', 'B', 'C', 'D', 'K'],
      ],
      ['#E32017', '#003688', '#FFD300', '#00782A'],
    );

    expect(layout.lines).toHaveLength(4);
    expect(layout.transfers.map((transfer) => transfer.name)).toEqual(['B', 'C', 'D']);

    for (const [fromName, toName] of [['B', 'C'], ['C', 'D']]) {
      for (let lineIndex = 0; lineIndex < layout.lines.length - 1; lineIndex++) {
        expectParallelSegments(
          station(layout, lineIndex, fromName),
          station(layout, lineIndex, toName),
          station(layout, lineIndex + 1, fromName),
          station(layout, lineIndex + 1, toName),
          10,
        );
      }
    }

    layout.lines.forEach((line) => {
      line.stations.forEach((item) => {
        const tickLength = Math.hypot(
          item.tick.x2 - item.tick.x1,
          item.tick.y2 - item.tick.y1,
        );
        expect(tickLength).toBeGreaterThan(0);

        if (item.terminus) {
          expect((item.tick.x1 + item.tick.x2) / 2).toBe(item.x);
          expect((item.tick.y1 + item.tick.y2) / 2).toBe(item.y);
        }
      });
    });
  });

  it('keeps successive overlaps parallel across a four-line chain', () => {
    const layout = new MetroMappingService().layout(
      [
        ['A', 'B', 'C'],
        ['B', 'C', 'D'],
        ['C', 'D', 'E'],
        ['D', 'E', 'F'],
      ],
      ['#E32017', '#003688', '#FFD300', '#00782A'],
    );

    const sharedSegments = [
      { lineA: 0, lineB: 1, from: 'B', to: 'C' },
      { lineA: 1, lineB: 2, from: 'C', to: 'D' },
      { lineA: 2, lineB: 3, from: 'D', to: 'E' },
    ];

    sharedSegments.forEach(({ lineA, lineB, from, to }) => {
      expectParallelSegments(
        station(layout, lineA, from),
        station(layout, lineA, to),
        station(layout, lineB, from),
        station(layout, lineB, to),
      );
    });
  });

  it('aligns ticks on fourth and fifth lines branching at different shared stations', () => {
    const layout = new MetroMappingService().layout(
      [
        ['A', 'B', 'C', 'D', 'E'],
        ['F', 'B', 'C', 'D', 'E', 'G'],
        ['B', 'HA', 'I'],
        ['C', 'J', 'K', 'L'],
        ['D', 'M', 'N'],
      ],
      ['#E32017', '#003688', '#FFD300', '#00782A', '#7156A5'],
    );

    expect(layout.lines.slice(2).map((line) => line.orientation)).toEqual([
      'vertical',
      'vertical',
      'vertical',
    ]);

    layout.lines.slice(2).forEach((line) => {
      line.stations.forEach((item) => {
        expect(item.tick.y1).toBe(item.y);
        expect(item.tick.y2).toBe(item.y);
        expect(item.tick.x1).not.toBe(item.tick.x2);
      });
    });
  });

  it('normalizes station names and resolves transfers across more than two lines', () => {
    const layout = new MetroMappingService().layout(
      [
        [' A ', 'B', '', 'C'],
        ['X', 'B', 'Y'],
        ['C', 'Z'],
        [],
        ['P', 'Q'],
      ],
      '#E32017',
    );

    expect(layout.lines).toHaveLength(4);
    expect(layout.lines[0].stations.map((item) => item.name)).toEqual(['A', 'B', 'C']);
    expect(layout.lines[3].stations.map((item) => item.name)).toEqual(['P', 'Q']);
    expect(layout.transfers.map((transfer) => transfer.name).sort()).toEqual(['B', 'C']);

    layout.lines.forEach((line) => {
      line.stations.forEach((item) => {
        expect(Number.isFinite(item.x)).toBe(true);
        expect(Number.isFinite(item.y)).toBe(true);
        expect(Math.hypot(
          item.tick.x2 - item.tick.x1,
          item.tick.y2 - item.tick.y1,
        )).toBeGreaterThan(0);
      });
    });
  });

  it('does not place a branch station on a different line station', () => {
    const layout = new MetroMappingService().layout(
      [
        ['A', 'B', 'C', 'D'],
        ['B', 'E', 'F', 'G'],
        ['D', 'H'],
      ],
      ['#E32017', '#003688', '#FFD300'],
    );

    const c = station(layout, 0, 'C');
    const h = station(layout, 2, 'H');
    expect(Math.hypot(c.x - h.x, c.y - h.y)).toBeGreaterThan(0);
  });

  it('routes later lines around station H and the third line', () => {
    const layout = new MetroMappingService().layout(
      [
        ['a', 'b', 'c', 'd'],
        ['b', 'e', 'f', 'g'],
        ['d', 'h', 'i', 'j'],
        ['c', '7', '8'],
        ['8', '0', '9', 'i'],
      ],
      ['#E32017', '#003688', '#FFD300', '#00782A', '#7156A5'],
    );

    const h = station(layout, 2, 'h');
    const nine = station(layout, 4, '9');
    const thirdLine = layout.lines[2].stations;
    const thirdLineStart = thirdLine[0];
    const thirdLineEnd = thirdLine[thirdLine.length - 1];
    const routedLines = layout.lines.slice(3);

    expect(nine.tick.x1).toBe(nine.tick.x2);
    expect(nine.tick.y1).not.toBe(nine.tick.y2);

    const pathCoordinates = (path: string) =>
      [...path.matchAll(/(?:M|L)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)]
        .map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));

    routedLines.forEach((line) => {
      const points = pathCoordinates(line.path);
      expect(points.some((point) => point.x === h.x && point.y === h.y)).toBe(false);

      const overlapsThirdLine = points.slice(1).some((point, index) => {
        const previous = points[index];
        if (previous.y !== h.y || point.y !== h.y) return false;
        const overlapStart = Math.max(
          Math.min(previous.x, point.x),
          Math.min(thirdLineStart.x, thirdLineEnd.x),
        );
        const overlapEnd = Math.min(
          Math.max(previous.x, point.x),
          Math.max(thirdLineStart.x, thirdLineEnd.x),
        );
        return overlapEnd > overlapStart;
      });

      expect(overlapsThirdLine).toBe(false);
    });
  });

  it('keeps the fifth line clear of F and the third line when H is added', () => {
    const layout = new MetroMappingService().layout(
      [
        ['a', 'b', 'c', 'd', 'h'],
        ['b', 'e', 'f', 'g'],
        ['d', 'h', 'i', 'j'],
        ['c', '7', '8'],
        ['8', '0', '9', 'i'],
      ],
      ['#E32017', '#003688', '#FFD300', '#00782A', '#7156A5'],
    );

    const f = station(layout, 1, 'f');
    const zero = station(layout, 4, '0');
    expect(Math.hypot(f.x - zero.x, f.y - zero.y)).toBeGreaterThan(0);

    const pathCoordinates = (path: string) =>
      [...path.matchAll(/(?:M|L)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g)]
        .map((match) => ({ x: Number(match[1]), y: Number(match[2]) }));
    const lineSegments = (path: string) => {
      const points = pathCoordinates(path);
      return points.slice(1).map((end, index) => ({
        start: points[index],
        end,
      }));
    };
    const thirdLineSegments = lineSegments(layout.lines[2].path);
    const fifthLineSegments = lineSegments(layout.lines[4].path);
    const overlaps = (
      first: { start: { x: number; y: number }; end: { x: number; y: number } },
      second: { start: { x: number; y: number }; end: { x: number; y: number } },
    ) => {
      const firstHorizontal = first.start.y === first.end.y;
      const secondHorizontal = second.start.y === second.end.y;
      if (firstHorizontal && secondHorizontal) {
        return first.start.y === second.start.y &&
          Math.min(Math.max(first.start.x, first.end.x), Math.max(second.start.x, second.end.x)) >
            Math.max(Math.min(first.start.x, first.end.x), Math.min(second.start.x, second.end.x));
      }

      const firstVertical = first.start.x === first.end.x;
      const secondVertical = second.start.x === second.end.x;
      return firstVertical && secondVertical &&
        first.start.x === second.start.x &&
        Math.min(Math.max(first.start.y, first.end.y), Math.max(second.start.y, second.end.y)) >
          Math.max(Math.min(first.start.y, first.end.y), Math.min(second.start.y, second.end.y));
    };

    expect(fifthLineSegments.some((fifthSegment) =>
      thirdLineSegments.some((thirdSegment) => overlaps(fifthSegment, thirdSegment)),
    )).toBe(false);
  });
});
