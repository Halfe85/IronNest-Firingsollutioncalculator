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

test('Add Reference routes unset Iron Nest directly to a dedicated required coordinate window',()=>{
  const html=readFileSync(new URL('./tactical-plotter.html',import.meta.url),'utf8');
  const ts=readFileSync(new URL('./tactical-plotter.ts',import.meta.url),'utf8');
  assert.match(ts,/addStep\.set\(this\.nestConfirmed\(\)\?'menu':'nest'\)/);
  assert.match(ts,/saveIronNest\(\):void/);
  assert.match(ts,/this\.setNestGrid\(\{\.\.\.grid\}\)/);
  assert.match(ts,/this\.addStep\.set\('menu'\)/);
  assert.match(ts,/if\(step!=='nest'&&!this\.nestConfirmed\(\)\)/);
  assert.match(html,/@else if\(addStep\(\)==='nest'\)/);
  assert.match(html,/IRON NEST POSITION REQUIRED/);
  assert.match(html,/\[disabled\]="!canSaveNest\(\)"/);
  assert.match(html,/\(click\)="saveIronNest\(\)"/);
});
test('reference chooser has four separate routes and no Observation / Waypoint dropdown',()=>{
  const html=readFileSync(new URL('./tactical-plotter.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('./tactical-plotter.css',import.meta.url),'utf8');
  for(const role of ['nest','spotter','reference','target']){
    assert.ok(html.includes("(click)=\"openAddWindow('"+role+"')\""));
  }
  assert.match(html,/addStep\(\)==='menu'/);
  assert.match(html,/class="plot-choice-grid"/);
  assert.match(html,/class="plot-dialog plot-add-dialog plot-type-dialog"/);
  assert.match(html,/\(click\)="backToAddMenu\(\)"/);
  assert.doesNotMatch(html,/\[value\]="plottingMode\(\)"/);
  assert.doesNotMatch(html,/WAYPOINT MODE|OBSERVATION MAP<\/option>/);
  assert.doesNotMatch(html,/REFERENCE TYPE/);
  assert.match(css,/@media\(max-width:420px\)/);
});
