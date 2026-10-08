import { Component, EventEmitter, Input, Output } from '@angular/core';
import { EMPTY_GRID, GRID_LETTERS, GRID_COLUMNS, GRID_SUBDIVISIONS, type GridInput } from './graph-math';

@Component({
  selector: 'app-grid-select', standalone: true,
  templateUrl: './grid-select.html', styleUrl: './grid-select.css'
})
export class GridSelectComponent {
  @Input({required: true}) value: GridInput = EMPTY_GRID;
  @Output() valueChange = new EventEmitter<GridInput>();
  readonly letters = GRID_LETTERS;
  readonly columns = GRID_COLUMNS;
  readonly sub = GRID_SUBDIVISIONS;
  changed(key: keyof GridInput, text: string): void {
    this.valueChange.emit({...this.value, [key]: key === 'letter' ? text : Number(text)});
  }
}
