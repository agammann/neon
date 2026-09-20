import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Wallet,verifyTypedData} from 'ethers';
import {handlePerpsApi,validatePerpsRequest} from '../src/perps-api.js';
import {DOMAIN,ORDER_TYPES,makeOrder,placeOrder} from '../src/synthetix-client.js';
import {openEthPositions,openEthOrders,orderOutcome} from '../src/perps-model.js';

test('Neon only proxies bounded Synthetix actions for the ETH market',async()=>{
  assert.equal(validatePerpsRequest({params:{action:'getMarketPrices'}}),'info');
  assert.throws(()=>validatePerpsRequest({params:{action:'deleteAccount'}}),/Unsupported/);
  assert.throws(()=>validatePerpsRequest({params:{action:'getCandles',symbol:'BTC-USDT',interval:'1h',limit:50}}),/Only ETH/);
  assert.equal(validatePerpsRequest({params:{action:'getIsWhitelisted',walletAddress:'0x1111111111111111111111111111111111111111'}}),'info');
  assert.throws(()=>validatePerpsRequest({params:{action:'getIsWhitelisted',walletAddress:'alice'}}),/Invalid wallet/);
  const upstream=[];
  const fetcher=async(url,options)=>{upstream.push({url,options});return new Response(JSON.stringify({status:'ok',response:{'ETH-USDT':{lastPrice:'2000'}}}),{status:200});};
  const response=await handlePerpsApi(new Request('http://localhost/api/perps',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({params:{action:'getMarketPrices'}})}),fetcher);
  assert.equal(response.status,200);
  assert.equal(upstream[0].url,'https://papi.synthetix.io/v1/info');
  assert.match(upstream[0].options.headers['user-agent'],/Neon/);
  const invalid=await handlePerpsApi(new Request('http://localhost/api/perps',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({params:{action:'getOrderbook',symbol:'BTC-USDT'}})}),fetcher);
  assert.equal(invalid.status,400);assert.equal(upstream.length,1);
});

test('ETH market order is EIP-712 signed by the user for the exact parameters sent',async()=>{
  const wallet=Wallet.createRandom(),order=makeOrder({side:'buy',type:'market',size:'0.01'});
  assert.equal(order.symbol,'ETH-USDT');assert.equal(order.price,'');
  assert.throws(()=>makeOrder({side:'buy',type:'market',size:'0.00001'}),/at least/);
  const originalFetch=globalThis.fetch;
  let sent;
  try{
    globalThis.fetch=async(_url,options)=>{sent=JSON.parse(options.body);return new Response(JSON.stringify({status:'ok',response:{statuses:[{filled:{quantity:'0.01'}}]}}),{status:200});};
    await placeOrder(wallet,'123',order);
  }finally{globalThis.fetch=originalFetch;}
  assert.equal(sent.params.action,'placeOrders');
  assert.equal(sent.params.orders[0].symbol,'ETH-USDT');
  const message={subAccountId:'123',orders:[order],grouping:'na',nonce:sent.nonce,expiresAfter:sent.expiresAfter};
  const signature=`0x${sent.signature.r.slice(2)}${sent.signature.s.slice(2)}${sent.signature.v.toString(16)}`;
  assert.equal(verifyTypedData(DOMAIN,ORDER_TYPES,message,signature),wallet.address);
  assert.equal(validatePerpsRequest(sent),'trade');
});

test('account data shows only actionable ETH positions and orders',()=>{
  assert.deepEqual(openEthPositions([{symbol:'ETH-USDT',status:'close',quantity:'1'},{symbol:'BTC-USDT',status:'open',quantity:'2'},{symbol:'ETH-USDT',status:'open',quantity:'0.5'}]).map(x=>x.quantity),['0.5']);
  assert.deepEqual(openEthOrders([{symbol:'ETH-USDT',quantity:'1',filledQuantity:'0.4',order:{venueId:'123'}},{symbol:'ETH-USDT',quantity:'1',filledQuantity:'1',order:{venueId:'124'}}]).map(x=>x.order.venueId),['123']);
  assert.equal(orderOutcome({statuses:[{resting:{order:{venueId:'123'}}}]}).label,'Order resting · #123');
  assert.equal(orderOutcome({statuses:[{filled:{quantity:'0.5'}}]}).kind,'filled');
  assert.throws(()=>orderOutcome({statuses:[{error:'insufficient margin'}]}),/insufficient margin/);
  assert.throws(()=>orderOutcome({statuses:[{}]}),/Unknown venue/);
});
