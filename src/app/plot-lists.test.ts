import {test} from 'node:test';
import assert from 'node:assert/strict';
import {groupMapPoints} from './plot-lists.ts';
import {type IntelNode} from './graph-math.ts';

test('reference count includes spotters and references, but excludes Iron Nest and targets',()=>{
  const nodes:IntelNode[]=[
    {id:'nest',role:'nest',name:'Iron Nest',reports:[]},
    {id:'spotter-one',role:'spotter',name:'Spotter #01',reports:[]},
    {id:'reference-one',role:'reference',name:'Reference - Bridge',reports:[]},
    {id:'reference-two',role:'reference',name:'Reference - Unresolved',reports:[]},
    {id:'target-one',role:'target',name:'Target #01',reports:[]}
  ];
  const lists=groupMapPoints(nodes);
  assert.deepEqual(lists.references.map(n=>n.id),[
    'spotter-one','reference-one','reference-two'
  ]);
  assert.deepEqual(lists.targets.map(n=>n.id),['target-one']);
  assert.equal(lists.references.length,3);
  assert.equal(lists.targets.length,1);
  assert.equal(groupMapPoints([nodes[0]]).references.length,0);
  assert.equal(groupMapPoints([nodes[0]]).targets.length,0);
});
