import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';

// Import the actual server with an OS-selected loopback port and its own
// disposable in-memory chain. No real wallet, network, or files are involved.
process.env.NEON_NATIVE_PORT='0';
const {server,chain}=await import('../lab-server.mjs');
if(!server.listening)await once(server,'listening');
const url=`http://127.0.0.1:${server.address().port}`;
after(async()=>{
  await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  await chain.disconnect();
});

async function action(body){
  const response=await fetch(`${url}/api/action`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  return {status:response.status,body:await response.json()};
}
async function success(body){
  const result=await action(body);
  assert.equal(result.status,200,JSON.stringify(result.body));
  return result.body;
}
async function openPair(){
  await success({action:'deposit',actor:'Alice',amount:'1'});
  await success({action:'deposit',actor:'Bob',amount:'1'});
  await success({action:'post',actor:'Alice',side:'long',amount:'1',leverage:5});
  return success({action:'match',actor:'Bob',id:'1',price:2000});
}

test('actorless liquidation and observed-outage refund reach the real contract',async()=>{
  await openPair();
  await success({action:'setPrice',price:1200});
  const liquidated=await success({action:'liquidate',id:'1'});
  assert.equal(liquidated.state.positions[0].active,false);
  assert.ok(liquidated.state.events.some(event=>event.name==='PositionSettled'));

  await success({action:'reset'});
  await openPair();
  await chain.request({method:'evm_increaseTime',params:[3601]});
  await chain.request({method:'evm_mine',params:[]});
  const observed=await success({action:'observe'});
  assert.ok(observed.state.outageObservedAt>0);
  const early=await action({action:'refund',id:'1'});
  assert.equal(early.status,400);
  assert.notEqual(early.body.error,'Choose Alice or Bob');
  await chain.request({method:'evm_increaseTime',params:[86401]});
  await chain.request({method:'evm_mine',params:[]});
  const refunded=await success({action:'refund',id:'1'});
  assert.equal(refunded.state.positions[0].active,false);
  assert.equal(refunded.state.balances.Alice.available,'1.0');
  assert.equal(refunded.state.balances.Bob.available,'1.0');
  assert.ok(refunded.state.events.some(event=>event.name==='PositionStaleRefunded'));
});
