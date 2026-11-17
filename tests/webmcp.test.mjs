import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

test('live book tool discloses maintenance writes and untrusted output',async()=>{
  const source=readFileSync(new URL('../src/orders-ui.js',import.meta.url),'utf8');
  const start=source.indexOf('if(document.modelContext?.registerTool)');
  assert.ok(start>=0,'Expected the actual live book tool registration');
  const tools=[],requests=[],book={chainId:1,orders:[],trades:[]};
  runInNewContext(source.slice(start),{
    document:{modelContext:{registerTool:tool=>tools.push(tool)}},
    api:async path=>{requests.push(path);return book;},
  });
  assert.equal(tools.length,1);
  const tool=tools[0];
  assert.equal(tool.name,'read_live_order_book');
  assert.deepEqual(JSON.parse(JSON.stringify(tool.inputSchema)),{type:'object',properties:{},additionalProperties:false});
  assert.equal(tool.annotations.readOnlyHint,false);
  assert.equal(tool.annotations.untrustedContentHint,true);
  assert.match(tool.description,/rate.limit/i);
  assert.match(tool.description,/reconcile cached order statuses and receipt block numbers/i);
  assert.match(tool.description,/this tool needs no wallet permission/i);
  assert.deepEqual(JSON.parse(JSON.stringify(await tool.execute({}))),{content:[{type:'text',text:JSON.stringify(book)}]});
  assert.deepEqual(requests,['/api/orders']);
});
