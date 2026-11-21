/**
 * Layout-engine voor een metrolijn in Beck-stijl (Londense metro):
 * - alleen horizontale, verticale en 45°-segmenten
 * - afgeronde bochten
 * - stations staan altijd op een recht stuk, bochten vallen tussen twee stations in
 *
 * De lijn slingert als een slang: een rij horizontaal, dan een "U-bocht" van
 * drie stations (45° → verticaal → 45°), dan een rij in tegengestelde richting.
 */

interface Dir {
  x: number;
  y: number;
}

const D = Math.SQRT1_2;
const E: Dir = { x: 1, y: 0 };
const SE: Dir = { x: D, y: D };
const S: Dir = { x: 0, y: 1 };
const SW: Dir = { x: -D, y: D };
const W: Dir = { x: -1, y: 0 };

export interface StationLabel {
  transform: string;
  anchor: 'start' | 'end';
}

export interface PlacedStation {
  name: string;
  x: number;
  y: number;
  terminus: boolean;
  tick: { x1: number; y1: number; x2: number; y2: number };
  label: StationLabel;
}

export interface MetroLayout {
  stations: PlacedStation[];
  path: string;
  viewBox: string;
}

export interface MetroLineLayout {
  color: string;
  stations: PlacedStation[];
  path: string;
}

export interface TransferStation {
  name: string;
  x: number;
  y: number;
  lineColors: string[];
}

export interface MetroNetworkLayout {
  lines: MetroLineLayout[];
  transfers: TransferStation[];
  viewBox: string;
}

interface Corner {
  x: number;
  y: number;
  din: Dir;
  dout: Dir;
}

const fmt = (n: number) => n.toFixed(2);

export function layoutLine(names: string[], perRow = 6, spacing = 80): MetroLayout {
  const n = names.length;
  if (n === 0) return { stations: [], path: '', viewBox: '0 0 100 100' };

  // 1. Richting waarin de lijn elk station passeert
  const plan: { d: Dir; kind: 'row' | 'turn'; side: 1 | -1 }[] = [];
  let heading: 1 | -1 = 1;
  while (plan.length < n) {
    for (let i = 0; i < perRow && plan.length < n; i++) {
      plan.push({ d: heading === 1 ? E : W, kind: 'row', side: heading });
    }
    const turn = heading === 1 ? [SE, S, SW] : [SW, S, SE];
    for (const d of turn) {
      if (plan.length >= n) break;
      plan.push({ d, kind: 'turn', side: heading });
    }
    heading = heading === 1 ? -1 : 1;
  }

  // 2. Posities van stations en bochten
  const pts: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  const corners: Corner[] = [];
  let px = 0;
  let py = 0;
  for (let i = 1; i < n; i++) {
    const prev = plan[i - 1].d;
    const cur = plan[i].d;
    if (prev === cur) {
      px += cur.x * spacing;
      py += cur.y * spacing;
    } else {
      const mx = px + (prev.x * spacing) / 2;
      const my = py + (prev.y * spacing) / 2;
      corners.push({ x: mx, y: my, din: prev, dout: cur });
      px = mx + (cur.x * spacing) / 2;
      py = my + (cur.y * spacing) / 2;
    }
    pts.push({ x: px, y: py });
  }

  // 3. Pad met afgeronde bochten (kwadratische Bézier per bocht)
  const t = spacing * 0.42;
  let path = `M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`;
  for (const c of corners) {
    path += ` L ${fmt(c.x - c.din.x * t)} ${fmt(c.y - c.din.y * t)}`;
    path += ` Q ${fmt(c.x)} ${fmt(c.y)} ${fmt(c.x + c.dout.x * t)} ${fmt(c.y + c.dout.y * t)}`;
  }
  const last = pts[n - 1];
  path += ` L ${fmt(last.x)} ${fmt(last.y)}`;

  // 4. Stations, streepjes en labels
  const FONT_W = 7.6; // geschatte tekstbreedte per teken (px)
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const grow = (x: number, y: number) => {
    bounds.minX = Math.min(bounds.minX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.maxY = Math.max(bounds.maxY, y);
  };

  const stations: PlacedStation[] = names.map((name, i) => {
    const { x, y } = pts[i];
    const { d, kind, side } = plan[i];
    const w = name.length * FONT_W;

    let lx: number;
    let ly: number;
    let rotate = 0;
    let anchor: 'start' | 'end';

    if (kind === 'row') {
      // Schuine labels boven de lijn, van het station af
      rotate = side === 1 ? -45 : 45;
      anchor = side === 1 ? 'start' : 'end';
      lx = x + (side === 1 ? 8 : -8);
      ly = y - 12;
      const ex = lx + (side === 1 ? 1 : -1) * w * D;
      grow(ex, ly - w * D - 8);
      grow(lx, ly);
    } else {
      // Bocht: label aan de buitenkant, horizontaal
      anchor = side === 1 ? 'start' : 'end';
      lx = x + side * (d.x === 0 ? 14 : 12);
      if (d.x === 0) ly = y + 4;
      else if (d.x * d.y > 0) ly = side === 1 ? y - 6 : y + 14;
      else ly = side === 1 ? y + 14 : y - 6;
      grow(lx + side * w, ly - 12);
      grow(lx + side * w, ly + 4);
    }

    grow(x - 14, y - 14);
    grow(x + 14, y + 14);

    const nx = -d.y;
    const ny = d.x;
    const L = 11;
    return {
      name,
      x,
      y,
      terminus: i === 0 || i === n - 1,
      tick: { x1: x - nx * L, y1: y - ny * L, x2: x + nx * L, y2: y + ny * L },
      label: {
        transform: `translate(${fmt(lx)} ${fmt(ly)}) rotate(${rotate})`,
        anchor,
      },
    };
  });

  const pad = 36;
  const vb = [
    fmt(bounds.minX - pad),
    fmt(bounds.minY - pad),
    fmt(bounds.maxX - bounds.minX + pad * 2),
    fmt(bounds.maxY - bounds.minY + pad * 2),
  ].join(' ');

  return { stations, path, viewBox: vb };
}

export function layoutMetroLines(
  nameLines: string[][],
  perRow = 6,
  colors: string[] = [],
): MetroNetworkLayout {
  const filteredLines = nameLines.map((names) => names.map((name) => name.trim()).filter(Boolean));
  const usableLines = filteredLines.filter((names) => names.length > 0);
  if (usableLines.length === 0) {
    return { lines: [], transfers: [], viewBox: '0 0 100 100' };
  }

  const lines: MetroLineLayout[] = [];
  const masterStations = new Map<string, { x: number; y: number }>();

  usableLines.forEach((names, lineIndex) => {
    const color = colors[lineIndex] ?? '#000000';
    if (lineIndex === 0) {
      const layout = layoutLine(names, perRow);
      layout.stations.forEach((station) => {
        masterStations.set(station.name, { x: station.x, y: station.y });
      });
      lines.push({ color, stations: layout.stations, path: layout.path });
      return;
    }

    const local = layoutLine(names, perRow);
    const shared = local.stations.find((station) => masterStations.has(station.name));
    let dx = 0;
    let dy = 160 * lineIndex;
    if (shared) {
      const master = masterStations.get(shared.name)!;
      dx = master.x - shared.x;
      dy = master.y - shared.y;
    }

    const points = local.stations.map((station) => {
      const master = masterStations.get(station.name);
      return master
        ? { x: master.x, y: master.y }
        : { x: station.x + dx, y: station.y + dy };
    });

    const stations = names.map((name, index): PlacedStation => {
      const point = points[index];
      const previous = points[Math.max(0, index - 1)];
      const next = points[Math.min(points.length - 1, index + 1)];
      const direction = previous === next
        ? { x: 1, y: 0 }
        : { x: next.x - previous.x, y: next.y - previous.y };
      const length = Math.hypot(direction.x, direction.y) || 1;
      const dxDirection = direction.x / length;
      const dyDirection = direction.y / length;
      const tickNormal = { x: -dyDirection, y: dxDirection };

      masterStations.set(name, point);

      return {
        name,
        x: point.x,
        y: point.y,
        terminus: index === 0 || index === names.length - 1,
        tick: {
          x1: point.x - tickNormal.x * 11,
          y1: point.y - tickNormal.y * 11,
          x2: point.x + tickNormal.x * 11,
          y2: point.y + tickNormal.y * 11,
        },
        label: {
          transform: `translate(${fmt(point.x + 10)} ${fmt(point.y - 12)}) rotate(0)`,
          anchor: 'start',
        },
      };
    });

    const path = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${fmt(point.x)} ${fmt(point.y)}`)
      .join(' ');
    lines.push({ color, stations, path });
  });

  const stationLines = new Map<string, string[]>();
  lines.forEach((line) => {
    line.stations.forEach((station) => {
      const lineColors = stationLines.get(station.name) ?? [];
      if (!lineColors.includes(line.color)) {
        lineColors.push(line.color);
      }
      stationLines.set(station.name, lineColors);
    });
  });

  const transfers: TransferStation[] = [];
  stationLines.forEach((lineColors, name) => {
    if (lineColors.length < 2) return;
    const station = lines
      .flatMap((line) => line.stations)
      .find((placed) => placed.name === name);
    if (station) {
      transfers.push({ name, x: station.x, y: station.y, lineColors });
    }
  });

  const allStations = lines.flatMap((line) => line.stations);
  if (allStations.length === 0) {
    return { lines: [], transfers: [], viewBox: '0 0 100 100' };
  }

  const xs = allStations.map((station) => station.x);
  const ys = allStations.map((station) => station.y);
  const minX = Math.min(...xs) - 36;
  const minY = Math.min(...ys) - 36;
  const width = Math.max(...xs) - Math.min(...xs) + 72;
  const height = Math.max(...ys) - Math.min(...ys) + 72;

  return {
    lines,
    transfers,
    viewBox: `${fmt(minX)} ${fmt(minY)} ${fmt(width)} ${fmt(height)}`,
  };
}
