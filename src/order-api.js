import {JsonRpcProvider} from 'ethers';
import {checkReadiness} from './readiness.js';
import {CHAIN_ID} from './network.js';
import {EXCHANGE,validateSignedOrder,readOrderState,verifyExchange,exchangeInterface} from './orders.js';
const json=(data,status=200)=>new Response(JSON.stringify(data,(_,v)=>typeof v==='bigint'?String(v):v),{status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}});
export async function bodyJSON(request){if(!request.headers.get('content-type')?.startsWith('application/json'))throw Error('JSON required');const reader=request.body?.getReader();if(!reader)throw Error('Request body required');let size=0,parts=[];for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();throw Error('Request is too large');}parts.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const p of parts){bytes.set(p,offset);offset+=p.length;}return JSON.parse(new TextDecoder().decode(bytes));}
class ClientInputError extends Error {}
async function inputJSON(request){
 try{return await bodyJSON(request);}catch(e){throw new ClientInputError(['JSON required','Request body required','Request is too large'].includes(e?.message)?e.message:'Invalid JSON request.');}
}
function inputOrder(payload){try{return validateSignedOrder(payload);}catch{throw new ClientInputError('Invalid signed order or execution network.');}}
async function throttle(request,db){const now=Math.floor(Date.now()/60000),ip=request.headers.get('cf-connecting-ip')||'local';const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip));const key=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')+':'+now;await db.prepare('DELETE FROM rate_limits WHERE minute < ?').bind(now-2).run();const r=await db.prepare('INSERT INTO rate_limits (key,minute,hits) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits').bind(key,now).first();return r.hits<=60;}
export async function handleOrderApi(request,env,localProvider){const url=new URL(request.url);if(!url.pathname.startsWith('/api/'))return null;let provider;
 try{if(!env.DB)return json({error:'Order storage is unavailable.'},503);if(!await throttle(request,env.DB))return json({error:'Too many requests. Retry in one minute.'},429);
  if(request.method==='GET'&&url.pathname==='/api/health')return json({service:'Neon order book',chainId:CHAIN_ID,storage:'ready'});
  provider=localProvider||new JsonRpcProvider(env.ETHEREUM_RPC_URL||'https://ethereum-rpc.publicnode.com',undefined,{batchMaxCount:20});
  if(request.method==='GET'&&url.pathname==='/api/readiness'){try{return json({service:'Neon',storage:'ready',ready:true,...await checkReadiness(provider)});}catch{return json({service:'Neon',storage:'ready',ready:false,error:'Ethereum readiness checks failed. Retry before trading.'},503);}}
  const now=Math.floor(Date.now()/1000);
  if(request.method==='GET'&&url.pathname==='/api/orders'){
    const page=Number(url.searchParams.get('page')||0);if(!Number.isSafeInteger(page)||page<0||page>500)throw new ClientInputError('Invalid page');const maker=url.searchParams.get('maker');if(maker&&!/^0x[0-9a-fA-F]{40}$/.test(maker))throw new ClientInputError('Invalid wallet address');
   const query=maker?'SELECT * FROM orders WHERE maker=? ORDER BY created_at DESC LIMIT 40':"SELECT * FROM (SELECT * FROM orders WHERE expiry>? AND side='sell' ORDER BY price_micros ASC,created_at ASC LIMIT 20 OFFSET ?) UNION ALL SELECT * FROM (SELECT * FROM orders WHERE expiry>? AND side='buy' ORDER BY price_micros DESC,created_at ASC LIMIT 20 OFFSET ?)";
   const rows=(await env.DB.prepare(query).bind(...(maker?[maker.toLowerCase()]:[now,page*20,now,page*20])).all()).results;
   const orders=[];for(let start=0;start<rows.length;start+=5){await Promise.all(rows.slice(start,start+5).map(async row=>{const payload=JSON.parse(row.payload),state=await readOrderState(provider,payload);if(state.status!==row.status)await env.DB.prepare('UPDATE orders SET status=? WHERE hash=?').bind(state.status,row.hash).run();orders.push({hash:row.hash,...payload,createdAt:row.created_at,state});}));}
   const candidates=(await env.DB.prepare('SELECT * FROM trades ORDER BY block_number DESC, log_index DESC LIMIT 30').all()).results;
   const receipts=new Map();for(let start=0;start<candidates.length;start+=5){await Promise.all([...new Set(candidates.slice(start,start+5).map(t=>t.tx_hash))].map(async hash=>{if(!receipts.has(hash))receipts.set(hash,await provider.getTransactionReceipt(hash));}));}
   const trades=[];for(const trade of candidates){const receipt=receipts.get(trade.tx_hash),log=receipt?.logs.find(l=>l.index===trade.log_index);let event;try{if(log?.address.toLowerCase()===EXCHANGE.toLowerCase())event=exchangeInterface.parseLog(log);}catch{}
    if(receipt?.status!==1||event?.name!=='LimitOrderFilled'||event.args.orderHash!==trade.order_hash){continue;}
    if(receipt.blockNumber!==trade.block_number)await env.DB.prepare('UPDATE trades SET block_number=? WHERE tx_hash=? AND log_index=?').bind(receipt.blockNumber,trade.tx_hash,trade.log_index).run();
    trades.push({...trade,block_number:receipt.blockNumber,block_hash:receipt.blockHash,finality:'not_checked'});
   }
   return json({chainId:CHAIN_ID,checkedAt:Date.now(),hasMore:rows.filter(r=>r.side==='buy').length===20||rows.filter(r=>r.side==='sell').length===20,orders:orders.filter(o=>maker||o.state.status===1),trades});
  }
  if(request.method==='POST'&&url.pathname==='/api/orders'){
    const payload=await inputJSON(request),info=inputOrder(payload);await verifyExchange(provider);const state=await readOrderState(provider,payload);if(!state.signatureValid||state.status!==1||state.fillable<BigInt(payload.order.takerAmount))throw new ClientInputError('Order must be fully funded and approved before publication.');
   const canonical={chainId:CHAIN_ID,order:payload.order,signature:payload.signature};const existing=await env.DB.prepare('SELECT hash FROM orders WHERE hash=?').bind(info.hash).first();if(existing)return json({hash:info.hash,duplicate:true});
   await env.DB.prepare('DELETE FROM orders WHERE expiry < ? AND hash NOT IN (SELECT order_hash FROM trades)').bind(now-604800).run();
   const result=await env.DB.prepare('INSERT INTO orders (hash,maker,side,payload,expiry,created_at,price_micros,status) SELECT ?,?,?,?,?,?,?,1 WHERE (SELECT COUNT(*) FROM orders WHERE maker=? AND expiry>? AND status=1)<20 AND (SELECT COUNT(*) FROM orders WHERE expiry>?)<10000').bind(info.hash,payload.order.maker.toLowerCase(),info.side,JSON.stringify(canonical),Number(payload.order.expiry),Date.now(),Number(info.usdt*10n**18n/info.weth),payload.order.maker.toLowerCase(),now,now).run();if(!result.meta.changes)return json({error:'Active order capacity reached. Cancel existing orders and refresh before posting more.'},409);return json({hash:info.hash},201);
  }
  if(request.method==='POST'&&url.pathname==='/api/receipts'){
    const inputHash=(await inputJSON(request))?.hash;const hash=typeof inputHash==='string'?inputHash.toLowerCase():inputHash;if(typeof hash!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(hash))throw new ClientInputError('Invalid transaction hash.');await verifyExchange(provider);const receipt=await provider.getTransactionReceipt(hash);if(!receipt||receipt.status!==1||receipt.to?.toLowerCase()!==EXCHANGE.toLowerCase())throw new ClientInputError('A confirmed exchange receipt is required.');let inserted=0;
   for(const log of receipt.logs.slice(0,100)){if(log.address.toLowerCase()!==EXCHANGE.toLowerCase())continue;let event;try{event=exchangeInterface.parseLog(log);}catch{continue;}if(event?.name!=='LimitOrderFilled')continue;const a=event.args;const known=await env.DB.prepare('SELECT hash FROM orders WHERE hash=?').bind(a.orderHash).first();if(!known)continue;const result=await env.DB.prepare('INSERT OR IGNORE INTO trades (tx_hash,log_index,order_hash,maker,taker,maker_token,taker_token,maker_amount,taker_amount,block_number) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(hash,log.index,a.orderHash,a.maker,a.taker,a.makerToken,a.takerToken,String(a.makerTokenFilledAmount),String(a.takerTokenFilledAmount),receipt.blockNumber).run();inserted+=Number(result.meta.changes);}return json({recorded:inserted});
  }
  return json({error:'Endpoint not found'},404);
  }catch(e){if(e instanceof ClientInputError)return json({error:e.message},400);console.error('Order API:',e?.shortMessage||e?.message||e);return json({error:'Order service unavailable. Retry shortly.'},503);}finally{if(provider&&!localProvider)provider.destroy();}
}
