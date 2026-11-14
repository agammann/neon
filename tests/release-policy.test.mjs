import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import publish from '../scripts/release.mjs';

test('published version remains unchanged with MIT license metadata',async()=>{
  const metadata=JSON.parse(readFileSync('package.json','utf8'));
  assert.equal(metadata.license,'MIT');
  const listReleases=()=>{};
  const messages=[];
  const github={
    rest:{repos:{listReleases}},
    paginate:async(fn,args)=>{
      assert.equal(fn,listReleases);
      assert.deepEqual(args,{owner:'agammann',repo:'neon',per_page:100});
      return [{tag_name:`v${metadata.version}`,draft:false}];
    },
  };
  await publish({github,context:{eventName:'push',ref:'refs/heads/main',sha:'a'.repeat(40),repo:{owner:'agammann',repo:'neon'}},core:{info:message=>messages.push(message)}});
  assert.match(messages.join('\n'),/already published; leaving it unchanged/);
});
