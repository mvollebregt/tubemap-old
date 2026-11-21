import { PlacedStation } from './placed-station.interface';

export interface MetroLineLayout {
  color: string;
  orientation: 'horizontal' | 'vertical';
  stations: PlacedStation[];
  path: string;
}
