import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getOrCreateToken} from './session-db.ts';
test('a reload with the same sessionStorage keeps the IDB session token',()=>{
  const map=new Map<string,string>();
  const storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);}};
  const first=getOrCreateToken(storage,()=> 'token-one');
  const second=getOrCreateToken(storage,()=> 'token-two');
  assert.deepEqual(first,{token:'token-one',fresh:true});
  assert.deepEqual(second,{token:'token-one',fresh:false});
});
test('new browser session gets a new token and triggers fresh IDB cleanup',()=>{
  const a=new Map<string,string>(),b=new Map<string,string>();
  const storage=(m:Map<string,string>)=>({getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v);}});
  assert.deepEqual(getOrCreateToken(storage(a),()=> 'first'),{token:'first',fresh:true});
  assert.deepEqual(getOrCreateToken(storage(b),()=> 'second'),{token:'second',fresh:true});
});
