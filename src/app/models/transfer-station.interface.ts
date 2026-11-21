import { StationLabel } from './station-label.interface';

export interface TransferStation {
  name: string;
  x: number;
  y: number;
  label: StationLabel;
}
