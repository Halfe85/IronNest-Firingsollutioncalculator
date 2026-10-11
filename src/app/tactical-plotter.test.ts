import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';

test('map-first plotter has Add Reference, filter, and an explicit Add transaction',()=>{
  const html=readFileSync(new URL('./tactical-plotter.html',import.meta.url),'utf8');
  const ts=readFileSync(new URL('./tactical-plotter.ts',import.meta.url),'utf8');
  const css=readFileSync(new URL('./tactical-plotter.css',import.meta.url),'utf8');
  assert.match(html,/class="plot-main-map"/);
  assert.match(html,/>\+ ADD REFERENCE<\/button>/);
  assert.match(html,/\(click\)="openAddReference\(\)"/);
  assert.match(html,/\(click\)="addReference\(\)"/);
  assert.match(html,/\[disabled\]="!canAddDraft\(\)"/);
  assert.match(html,/IRON NEST POSITION REQUIRED/);
  assert.match(html,/\(markerSelect\)="openNode\(\$event\)"/);
  assert.match(html,/\[observations\]="visibleObservations\(\)"/);
  assert.match(html,/setAllReportsVisible/);
  assert.match(ts,/readonly hiddenReportIds=signal<string\[\]>/);
  assert.match(ts,/this\.fireSolution\.emit/);
  assert.match(ts,/stayOnPlot:true/);
  assert.match(css,/\.plot-main-map\{flex:1/);
});
test('map markers open editing and the parent plot view fills available height',()=>{
  const map=readFileSync(new URL('./plot-map.html',import.meta.url),'utf8');
  const app=readFileSync(new URL('./app.html',import.meta.url),'utf8');
  const appCss=readFileSync(new URL('./app.css',import.meta.url),'utf8');
  assert.match(map,/selectMarker\(marker\.id\)/);
  assert.match(app,/\[class\.plot-view\]="tab\(\)==='plot'"/);
  assert.match(appCss,/\.main-content\.plot-view\{/);
});
