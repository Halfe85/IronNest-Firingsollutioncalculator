import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shotFloatPlacement} from './shot-float.ts';
const viewport={left:0,top:0,width:1280,height:900};
const content={left:0,top:101,width:1280,height:734};
test('hovered card floats toward viewport center without leaving content bounds',()=>{
  const src={left:28,top:140,width:170,height:130};
  const p=shotFloatPlacement(src,viewport,content,false);
  assert.equal(p.width,425);
  assert.equal(p.height,440);
  assert.ok(p.left>src.left);
  assert.ok(p.top>content.top);
  assert.ok(p.left+p.width<=content.left+content.width-12);
  assert.ok(p.top+p.height<=content.top+content.height-12);
  assert.ok(p.scaleX<1&&p.scaleY<1);
  assert.equal(p.fromX,src.left-p.left);
});
test('far right and bottom hovered card never extends or expands its scroll container',()=>{
  const src={left:1070,top:715,width:170,height:110};
  const p=shotFloatPlacement(src,viewport,content,false);
  assert.ok(p.left>=12&&p.left+p.width<=1268);
  assert.ok(p.top>=113&&p.top+p.height<=823);
});
test('phone tap expands almost full viewport and keeps original transform anchor',()=>{
  const v={left:0,top:0,width:360,height:740};
  const p=shotFloatPlacement({left:190,top:210,width:155,height:97},
    v,{left:0,top:50,width:360,height:630},true);
  assert.equal(p.width,340);
  assert.equal(p.height,720);
  assert.equal(p.left,10);
  assert.equal(p.top,10);
  assert.ok(p.scaleX>0&&p.scaleX<1);
});
test('very short desktop heights are clamped to visible space',()=>{
  const v={left:0,top:0,width:800,height:320};
  const c={left:0,top:70,width:800,height:196};
  const p=shotFloatPlacement({left:520,top:110,width:135,height:95},v,c,false);
  assert.equal(p.height,172);
  assert.ok(p.top>=82&&p.top+p.height<=254);
});
