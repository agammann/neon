export function openEthPositions(response){
  const items=Array.isArray(response)?response:response?.positions;
  if(!Array.isArray(items))throw new Error('Unexpected positions response from venue');
  return items.filter(item=>item.symbol==='ETH-USDT'&&item.status==='open'&&Number(item.quantity)>0);
}

export function openEthOrders(response){
  const items=Array.isArray(response)?response:response?.orders;
  if(!Array.isArray(items))throw new Error('Unexpected orders response from venue');
  return items.filter(item=>item.symbol==='ETH-USDT'&&Boolean(item.order?.venueId||item.orderId)&&Number(item.quantity)>Number(item.filledQuantity||0));
}

export function orderOutcome(response){
  const status=response?.statuses?.[0];
  if(!status)throw new Error('Venue did not confirm the order outcome. Check positions and orders before retrying.');
  if(status.error)throw new Error(typeof status.error==='string'?status.error:status.error.message||'Order rejected');
  if(status.filled)return {kind:'filled',label:'Order filled'};
  if(status.resting)return {kind:'resting',label:`Order resting${status.resting.order?.venueId?` · #${status.resting.order.venueId}`:''}`};
  if(status.canceled)return {kind:'canceled',label:'Order canceled by venue'};
  throw new Error('Unknown venue order outcome. Check positions and orders before retrying.');
}
