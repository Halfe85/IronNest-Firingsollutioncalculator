import assert from 'node:assert/strict';
import {test} from 'node:test';
import {cannonOrUnassigned,normalizeShell} from './shot-options.ts';

test('cannon side is explicit, historical shots remain unassigned',()=>{
  assert.equal(cannonOrUnassigned('left'),'left');
  assert.equal(cannonOrUnassigned('right'),'right');
  assert.equal(cannonOrUnassigned(undefined),null);
  assert.equal(cannonOrUnassigned('center'),null);
});
test('valid shell selection is retained; invalid source values fall back safely',()=>{
  assert.equal(normalizeShell('AP'),'AP');
  assert.equal(normalizeShell('HCHE'),'HCHE');
  assert.equal(normalizeShell('NOT_A_SHELL'),'HCHE');
});
