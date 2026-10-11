import {type IntelNode} from './graph-math';

/** Spotters belong to references; the Iron Nest and targets do not. */
export function groupMapPoints(nodes:readonly IntelNode[]):{
  references:IntelNode[];
  targets:IntelNode[];
}{
  return {
    references:nodes.filter(n=>n.role==='spotter'||n.role==='reference'),
    targets:nodes.filter(n=>n.role==='target')
  };
}
