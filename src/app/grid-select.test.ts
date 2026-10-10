import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gridInputFromText,gridInputLabel,EMPTY_GRID} from './graph-math.ts';
import {initialFiringGrid} from './impact-correction.ts';
import {parseGrid} from './map-math.ts';

test('saved firing record initializes the impact grid as I9 7:7, never the empty default',()=>{
  // Exact coordinate data from a real IndexedDB firing record.
  const saved=JSON.parse(JSON.stringify({
    bearing:45,distanceKm:11,charges:3,
    nestPosition:{x:0.9,y:0.9},
    targetPosition:{x:8.678174593052022,y:8.678174593052024},
    aimPosition:{x:8.678174593052022,y:8.678174593052024},
    initialFiringGrid:'I9 7:7',revisions:[],lastReport:null
  }));
  const original=initialFiringGrid(saved);
  assert.equal(original,'I9 7:7');
  const control=gridInputFromText(original!);
  assert.deepEqual(control,{letter:'I',column:9,x:7,y:7});
  assert.notDeepEqual(control,EMPTY_GRID);
  assert.equal(gridInputLabel(control!),original);
  assert.deepEqual(parseGrid(original!),{x:8.7,y:8.7});
});

test('shared grid select template binds selected options for all four inputs',()=>{
  // Browser select elements can default to their first option when @for
  // creates options after the select [value] binding has already run.
  const html=readFileSync(new URL('./grid-select.html',import.meta.url),'utf8');
  for(const key of ['letter','column','x','y']){
    assert.ok(html.includes('[selected]="v===value.'+key+'"'),
      key+' must select the matching option, even on first modal render');
  }
});

test('grid coordinates remain stable across subsequent selection updates',()=>{
  const first=gridInputFromText('I9 7:7')!;
  assert.deepEqual({...first,x:5},{letter:'I',column:9,x:5,y:7});
  assert.equal(gridInputLabel({...first,x:5}),'I9 5:7');
  assert.deepEqual(gridInputFromText(gridInputLabel(first)),first);
});
