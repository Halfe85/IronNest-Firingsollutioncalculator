import {test} from 'node:test';
import assert from 'node:assert/strict';
import {constrain,homeCamera,initialCamera,panCamera,viewFor,zoomCamera} from './plot-navigation.ts';

test('map camera fits the entire map at zoom 1 regardless of phone aspect ratio',()=>{
  for(const size of [{width:350,height:560},{width:920,height:260},{width:1440,height:850}]){
    const v=viewFor(homeCamera,size);
    assert.ok(v.width>=960&&v.height>=515);
    assert.ok(v.x<=0&&v.y<=0);
    assert.ok(v.x+v.width>=960&&v.y+v.height>=515);
    assert.ok(Math.abs(v.width/v.height-size.width/size.height)<1e-8);
  }
});
test('phone opens zoomed in and remains independently pannable',()=>{
  const size={width:350,height:480};
  const camera=initialCamera(size);
  assert.ok(camera.zoom>=2.5);
  const moved=panCamera(camera,size,-80,25);
  assert.ok(moved.x>camera.x);
  assert.ok(moved.y<camera.y);
  assert.equal(moved.zoom,camera.zoom);
});
test('pinch zoom keeps the point under fingers stationary in SVG coordinates',()=>{
  const size={width:400,height:620},before={x:520,y:265,zoom:2};
  const pivot={x:128,y:177};
  const v1=viewFor(before,size);
  const wx=v1.x+pivot.x*v1.width/size.width;
  const wy=v1.y+pivot.y*v1.height/size.height;
  const after=zoomCamera(before,size,1.7,pivot.x,pivot.y);
  const v2=viewFor(after,size);
  assert.ok(Math.abs((v2.x+pivot.x*v2.width/size.width)-wx)<1e-8);
  assert.ok(Math.abs((v2.y+pivot.y*v2.height/size.height)-wy)<1e-8);
});
test('zoom and drag clamp safely',()=>{
  const size={width:320,height:500};
  const max=zoomCamera(homeCamera,size,500,160,250);
  assert.equal(max.zoom,8);
  assert.equal(zoomCamera(max,size,.001,160,250).zoom,1);
  const p=constrain({x:100000,y:-100000,zoom:500},size);
  assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));
  assert.equal(p.zoom,8);
});
