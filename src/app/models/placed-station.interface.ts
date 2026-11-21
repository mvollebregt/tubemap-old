import { StationLabel } from './station-label.interface';
import { StationTick } from './station-tick.interface';

export interface PlacedStation {
  name: string;
  x: number;
  y: number;
  terminus: boolean;
  tick: StationTick;
  label: StationLabel;
}
