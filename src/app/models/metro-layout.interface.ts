import { PlacedStation } from './placed-station.interface';
import { MetroLineLayout } from './metro-line-layout.interface';
import { TransferStation } from './transfer-station.interface';

export interface MetroLayout {
  stations: PlacedStation[];
  path: string;
  viewBox: string;
  lines: MetroLineLayout[];
  transfers: TransferStation[];
}
