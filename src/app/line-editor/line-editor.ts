import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface MetroLine {
  name: string;
  color: string;
}

@Component({
  selector: 'app-line-editor',
  imports: [FormsModule],
  templateUrl: './line-editor.html',
  styleUrl: './line-editor.css',
})
export class LineEditorComponent {
  readonly text = input.required<string>();
  readonly lines = input.required<readonly MetroLine[]>();
  readonly lineColor = input.required<string>();
  readonly perRow = input.required<number>();

  readonly textChange = output<string>();
  readonly lineColorChange = output<string>();
  readonly perRowChange = output<number>();

  setPerRow(value: number | string | null): void {
    this.perRowChange.emit(Number(value) || 6);
  }
}
