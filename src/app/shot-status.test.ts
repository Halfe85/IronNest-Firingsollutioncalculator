import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {splitFiringCards,nextActiveFiringCard} from './shot-status.ts';

test('hit card leaves active targets and enters the neutralized deck',()=>{
  const rows=[
    {id:'a',state:'pending' as const},
    {id:'b',state:'hit' as const,hitAt:'2026-10-10T15:00:00Z'},
    {id:'c',state:'miss' as const},
    {id:'d',state:'hit' as const,hitAt:'2026-10-10T15:02:00Z'}
  ];
  const grouped=splitFiringCards(rows);
  assert.deepEqual(grouped.active.map(r=>r.id),['a','c']);
  assert.deepEqual(grouped.neutralized.map(r=>r.id),['d','b']);
  assert.equal(nextActiveFiringCard(rows,'b'),'a');
  assert.equal(nextActiveFiringCard(rows,'c'),'c');
});
test('all targets neutralized leaves no active firing solution',()=>{
  const rows=[{id:'a',state:'hit' as const},{id:'b',state:'hit' as const}];
  assert.equal(nextActiveFiringCard(rows,'a'),null);
  assert.deepEqual(splitFiringCards(rows).active,[]);
});
test('restoring a neutralized card returns it to active selection and grouping',()=>{
  const saved=[{id:'a',state:'hit' as const,hitAt:'2026-10-10T15:00:00Z'}];
  const restored=saved.map(r=>({...r,state:'pending' as const,hitAt:null}));
  assert.deepEqual(splitFiringCards(restored).neutralized,[]);
  assert.equal(nextActiveFiringCard(restored,'a'),'a');
});
test('grouping does not mutate IndexedDB-style card order',()=>{
  const records=[
    {id:'a',state:'hit' as const,hitAt:'2026-10-10T15:00:00Z'},
    {id:'b',state:'pending' as const},
    {id:'c',state:'hit' as const,hitAt:'2026-10-10T16:00:00Z'}
  ];
  const first=records.map(r=>r.id);
  splitFiringCards(records);
  assert.deepEqual(records.map(r=>r.id),first);
});

test('firing controls present HIT/MISS labels and mobile neutralized tabs',()=>{
  const html=readFileSync(new URL('./app.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('./app.css',import.meta.url),'utf8');
  assert.match(html,/>HIT<\/button>/);
  assert.match(html,/>MISS<\/button>/);
  assert.match(html,/NEUTRALIZED/);
  assert.match(html,/shot-status-tabs/);
  assert.match(html,/RESTORE TO ACTIVE/);
  assert.match(css,/\.shots-neutralized-dock\{/);
  assert.match(css,/\.shot-tile\.shot-fading\{/);
  assert.match(css,/@media\(max-width:600px\)/);
});
