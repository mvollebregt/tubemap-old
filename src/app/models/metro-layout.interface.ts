import { PlacedStation } from './placed-station.interface';

export interface MetroLayout {
  stations: PlacedStation[];
  path: string;
  viewBox: string;
}
