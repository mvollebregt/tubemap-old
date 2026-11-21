import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MetroLine } from '../models/metro-line.interface';

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

  readonly textChange = output<string>();
  readonly lineColorChange = output<string>();
}
