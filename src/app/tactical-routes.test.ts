import {test} from 'node:test';
import assert from 'node:assert/strict';
import {routeOverlay,routeGeometry,importLegacyRoutes,predictRouteAt,type TacticalRoute} from './tactical-routes.ts';

const route:TacticalRoute={
  id:'route-1',name:'High Tide',stationGrid:'',stationReferenceId:'ref-1',
  railBearing:'90',approachSide:'bearing',routeSpeed:'36',
  targetLabel:'Train',
  stops:[
    {id:'first',name:'First',kmFromStation:3,time:'11:00:00',method:'route'},
    {id:'arrival',name:'Arrival',kmFromStation:0,time:'11:05:00',method:'route'}
  ]
};
test('waypoint route resolves from existing tactical reference and draws one map segment',()=>{
  const origins=[{id:'ref-1',name:'Station',grid:'J5 0:0'}];
  const solved=routeGeometry(route,origins,'A1 0:0');
  assert.equal(solved.points.length,2);
  assert.ok(solved.points[0]&&solved.points[1]);
  const drawing=routeOverlay([route],origins,'A1 0:0');
  assert.equal(drawing.markers.length,2);
  assert.equal(drawing.segments.length,1);
  assert.equal(drawing.markers[1].arrival,true);
  assert.equal(drawing.markers[0].routeId,'route-1');
});
test('missing tactical reference leaves route unlocated instead of using a guessed coordinate',()=>{
  const solved=routeGeometry(route,[],'A1 0:0');
  assert.ok(solved.points.every(point=>point===null));
  assert.equal(routeOverlay([route],[],'A1 0:0').markers.length,0);
});
test('legacy waypoint imports retain individual stops and saved route references',()=>{
  const saved={id:'old',name:'Earlier train',stationGrid:'J5 0:0',railBearing:'90',
    approachSide:'bearing',stops:route.stops,routeSpeed:'36',
    references:[{id:'rail',name:'Old lookout',grid:'E5 0:0'}]};
  const imported=importLegacyRoutes({savedRoutes:[saved]});
  assert.equal(imported.length,1);
  assert.equal(imported[0].references?.[0]?.id,'rail');
  assert.equal(imported[0].stops[0].id,'first');
  assert.deepEqual(importLegacyRoutes(null),[]);
});

test('predicted moving target uses saved route timing and rejects extrapolation',()=>{
  const origins=[{id:'ref-1',name:'Station',grid:'J5 0:0'}];
  const atTime=predictRouteAt(route,origins,'A1 0:0','11:02:30');
  assert.equal(atTime.ok,true);
  if(atTime.ok){
    assert.ok(atTime.result.grid);
    assert.ok(atTime.result.rangeKm>0);
  }
  assert.equal(predictRouteAt(route,origins,'A1 0:0','11:07:30').ok,false);
  assert.equal(predictRouteAt(route,[],'A1 0:0','11:02:30').ok,false);
  assert.equal(predictRouteAt(route,origins,'','11:02:30').ok,false);
});
