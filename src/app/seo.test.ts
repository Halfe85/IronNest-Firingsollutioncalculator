import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync,existsSync} from 'node:fs';

const base='https://halfe85.github.io/IronNest-Firingsollutioncalculator/';
const read=(path:string)=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const slugs=['firing-solutions','tactical-plotting','moving-targets'];
test('homepage has unique descriptive search metadata and free web application JSON-LD',()=>{
  const html=read('src/index.html');
  assert.match(html,/<title>Iron Nest Calculator \| Firing Solutions/);
  assert.match(html,/<meta name="description" content="Free, unofficial Iron Nest calculator/);
  assert.ok(html.includes('<link rel="canonical" href="'+base+'">'));
  const match=/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(match);
  const data=JSON.parse(match![1]);
  assert.equal(data['@type'],'WebApplication');
  assert.equal(data.offers.price,'0');
  assert.equal(data.isAccessibleForFree,true);
  assert.equal(data.url,base);
  assert.match(html,/<app-root>/);
  assert.match(html,/href="guides\/firing-solutions\.html"/);
});
test('site map lists only real canonical crawlable home and guides',()=>{
  const xml=read('public/sitemap.xml');
  const matches=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>x[1]);
  assert.deepEqual(matches,[base,...slugs.map(s=>base+'guides/'+s+'.html')]);
  for(const slug of slugs)assert.ok(existsSync(new URL('../../public/guides/'+slug+'.html',import.meta.url)));
  assert.ok(read('public/robots.txt').includes('Sitemap: '+base+'sitemap.xml'));
});
test('guides remain crawlable without Angular or script execution',()=>{
  for(const slug of slugs){
    const html=read('public/guides/'+slug+'.html');
    assert.match(html,/<h1>[^<]+<\/h1>/);
    assert.match(html,/<meta name="description"/);
    assert.match(html,/<link rel="canonical"/);
    assert.ok(html.includes('href="../"'));
    assert.ok(html.includes('href="guide.css"'));
    assert.ok(!html.includes('<app-root>'));
    assert.ok(html.length>4000,'Guide should have useful substantial editorial content');
  }
});
test('Angular header visibly links to guide pages',()=>{
  const app=read('src/app/app.html');
  assert.ok(app.includes('<h1 class="top-brand">'));
  assert.ok(app.includes('class="top-guide-link"'));
  assert.ok(app.includes('href="guides/firing-solutions.html"'));
});
