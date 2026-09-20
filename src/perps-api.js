const API = 'https://papi.synthetix.io/v1';
const USER_AGENT = 'Neon/2.0 (Ethereum perpetual trading terminal)';
const publicActions = new Set(['getMarkets', 'getMarketPrices', 'getOrderbook', 'getCandles', 'getFundingRate', 'getCollaterals', 'getSubAccountIds', 'getIsWhitelisted']);
const tradeActions = new Set(['getSubAccount', 'getPositions', 'getOpenOrders', 'placeOrders', 'cancelOrders', 'updateLeverage', 'withdrawCollateral']);
const jsonHeaders = {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const reply = (data,status=200) => new Response(JSON.stringify(data),{status,headers:jsonHeaders});

export function validatePerpsRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !body.params || typeof body.params !== 'object') throw new Error('Invalid request');
  const action = body.params.action;
  const isPublic = publicActions.has(action);
  if (!isPublic && !tradeActions.has(action)) throw new Error('Unsupported action');
  if (['getSubAccountIds','getIsWhitelisted'].includes(action) && !/^0x[\da-fA-F]{40}$/.test(body.params.walletAddress || '')) throw new Error('Invalid wallet address');
  if (['getOrderbook','getCandles'].includes(action) && body.params.symbol !== 'ETH-USDT') throw new Error('Only ETH-USDT is available');
  if (action === 'getCandles') {
    if (!['1m','5m','15m','1h','4h','1d'].includes(body.params.interval) || !Number.isInteger(body.params.limit) || body.params.limit < 1 || body.params.limit > 120) throw new Error('Invalid candle request');
  }
  if (!isPublic) {
    if (!/^\d{1,24}$/.test(String(body.params.subAccountId || ''))) throw new Error('Invalid subaccount');
    const sig=body.signature;
    if (!sig || ![0,1,27,28].includes(sig.v) || !/^0x[\da-fA-F]{64}$/.test(sig.r || '') || !/^0x[\da-fA-F]{64}$/.test(sig.s || '')) throw new Error('Invalid signature');
    if (['placeOrders','cancelOrders','updateLeverage','withdrawCollateral'].includes(action) && (!Number.isSafeInteger(body.nonce) || body.nonce <= 0)) throw new Error('Invalid nonce');
    if (action === 'placeOrders') {
      if (!Array.isArray(body.params.orders) || body.params.orders.length !== 1) throw new Error('Place one order at a time');
      const order=body.params.orders[0];
      if (order.symbol !== 'ETH-USDT' || !['buy','sell'].includes(order.side) || !['market','limitGtc'].includes(order.orderType)) throw new Error('Invalid ETH order');
    }
    if (action === 'updateLeverage' && body.params.symbol !== 'ETH-USDT') throw new Error('Invalid leverage market');
    if (action === 'withdrawCollateral' && (body.params.symbol !== 'WETH' || !/^0x[\da-fA-F]{40}$/.test(body.params.destination || ''))) throw new Error('Only WETH withdrawals to an Ethereum address are available');
  }
  return isPublic ? 'info' : 'trade';
}

export async function handlePerpsApi(request,fetcher=fetch) {
  if (request.method !== 'POST') return reply({error:'POST required'},405);
  if (!String(request.headers.get('content-type') || '').startsWith('application/json')) return reply({error:'JSON required'},415);
  if (Number(request.headers.get('content-length') || 0) > 32768) return reply({error:'Request too large'},413);
  let raw;
  try { raw=await request.text(); if (raw.length>32768) return reply({error:'Request too large'},413); } catch { return reply({error:'Unable to read request'},400); }
  let body,endpoint;
  try { body=JSON.parse(raw); endpoint=validatePerpsRequest(body); } catch(e) { return reply({error:e.message},400); }
  try {
    const upstream=await fetcher(`${API}/${endpoint}`,{method:'POST',headers:{'content-type':'application/json','user-agent':USER_AGENT},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
    const result=await upstream.text();
    if(result.length>500000) return reply({error:'Upstream response too large'},502);
    return new Response(result,{status:upstream.status,headers:jsonHeaders});
  } catch { return reply({error:'Market service unavailable'},502); }
}
