import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('./app.html',import.meta.url),'utf8');
const css=readFileSync(new URL('./app.css',import.meta.url),'utf8');
const ts=readFileSync(new URL('./app.ts',import.meta.url),'utf8');
test('the active and neutralized decks each show compact cards',()=>{
  assert.equal((html.match(/class="shot-compact/g)||[]).length,2);
  assert.match(html,/\[attr\.data-shot-id\]="shot\.id"/);
  assert.match(html,/\(mouseenter\)="hoverShot\(shot\.id,\$event\)"/);
  assert.match(html,/\(click\)="tapShot\(shot\.id,\$event\)"/);
});
test('full card only renders as floating overlay and cannot expand the grid',()=>{
  assert.match(html,/class="shot-float-window"/);
  assert.match(html,/ngTemplateOutlet="shotCard;context:\{\$implicit:expanded\}"/);
  assert.match(css,/\.shot-float-window\{\s*position:fixed/);
  assert.match(css,/\.shots-workspace \.shot-tiles\{/);
});
test('desktop hover collapse waits 800 ms, mobile Back and close are wired',()=>{
  assert.match(ts,/setTimeout\(\(\)=>this\.startExpandedClose\(\),800\)/);
  assert.match(ts,/@HostListener\('window:popstate'\)/);
  assert.match(ts,/window\.history\.pushState/);
  assert.match(ts,/window\.history\.back\(\)/);
  assert.match(html,/\(click\)="closeExpandedShot\(\)"/);
  assert.match(css,/shot-float-close/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
