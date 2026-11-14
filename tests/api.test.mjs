import {test} from 'node:test';import assert from 'node:assert/strict';import {localDB} from '../scripts/local-db.mjs';import {handleOrderApi,bodyJSON} from '../src/order-api.js';
test('order API health reads actual storage and enforces request budget',async()=>{const db=localDB(':memory:');try{let response;for(let i=0;i<61;i++)response=await handleOrderApi(new Request('http://localhost/api/health'),{DB:db});assert.equal(response.status,429);assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM rate_limits').first()).count,1);}finally{db.close();}});
test('order requests reject oversized bodies and unsupported content types',async()=>{await assert.rejects(bodyJSON(new Request('http://localhost/api/orders',{method:'POST',body:'x',headers:{'content-type':'text/plain'}})));await assert.rejects(bodyJSON(new Request('http://localhost/api/orders',{method:'POST',body:'x'.repeat(9000),headers:{'content-type':'application/json'}})));});
test('unsigned orders cannot enter shared storage',async()=>{const db=localDB(':memory:');try{const r=await handleOrderApi(new Request('http://localhost/api/orders',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chainId:1,order:{},signature:'bad'})}),{DB:db});assert.equal(r.status,400);assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM orders').first()).count,0);}finally{db.close();}});

test('internal database errors do not expose details to clients',async()=>{
 const marker='SYNTHETIC_DB_PRIVATE_DETAIL';
 const db={prepare(){throw Error(marker);}};
 const r=await handleOrderApi(new Request('http://localhost/api/health'),{DB:db});
 assert.deepEqual({status:r.status,markerInBody:(await r.text()).includes(marker)},{status:503,markerInBody:false});
});

test('internal provider errors do not expose details to clients',async()=>{
 const marker='SYNTHETIC_RPC_PRIVATE_DETAIL';
 const provider={getNetwork:async()=>{throw Error(marker);}};
 const db=localDB(':memory:');
 try{
  const r=await handleOrderApi(new Request('http://localhost/api/receipts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({hash:'0x'+'a'.repeat(64)})}),{DB:db},provider);
  assert.deepEqual({status:r.status,markerInBody:(await r.text()).includes(marker)},{status:503,markerInBody:false});
 }finally{db.close();}
});

test('invalid user input keeps a safe HTTP 400 response',async()=>{
 const db=localDB(':memory:');
 try{
  const r=await handleOrderApi(new Request('http://localhost/api/orders?page=-1'),{DB:db},{});
  assert.equal(r.status,400);
  assert.equal((await r.json()).error,'Invalid page');
 }finally{db.close();}
});

test('malformed receipt input is rejected before provider access',async()=>{
 const db=localDB(':memory:');
 const provider={getNetwork:async()=>{throw Error('provider should not be called');}};
 try{
  const r=await handleOrderApi(new Request('http://localhost/api/receipts',{method:'POST',headers:{'content-type':'application/json'},body:'null'}),{DB:db},provider);
  assert.equal(r.status,400);
  assert.equal((await r.json()).error,'Invalid transaction hash.');
 }finally{db.close();}
});
