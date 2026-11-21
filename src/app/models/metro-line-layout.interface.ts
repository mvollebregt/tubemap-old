import { PlacedStation } from './placed-station.interface';

export interface MetroLineLayout {
  color: string;
  orientation: 'horizontal' | 'vertical' | 'diagonal';
  stations: PlacedStation[];
  path: string;
  sharedStationNames: string[];
  boundaryStationNames: string[];
}
