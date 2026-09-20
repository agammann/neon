import {getAddress} from 'ethers';
import {perpsRequest,connectWallet,accountRequest,setLeverage,placeOrder,cancelOrder,makeOrder,walletBalances,wrapEth,depositWeth,withdrawWeth,unwrapWeth} from './synthetix-client.js';
import {openEthPositions,openEthOrders,orderOutcome} from './perps-model.js';

const $=id=>document.getElementById(id);
const number=(value,digits=2)=>Number(value).toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
const state={wallet:null,subAccountId:null,eligible:null,price:null,market:null,marketUpdatedAt:0,side:'buy',type:'market',interval:'1h',tab:'positions',positions:[],orders:[]};
const status=(id,message)=>{$(id).textContent=message;};
function ready(){const fresh=Date.now()-state.marketUpdatedAt<60000;const canTrade=!!state.wallet&&!!state.subAccountId&&state.eligible===true&&!!state.market?.isOpen&&!state.market?.isCloseOnly&&fresh;$('submit-order').disabled=!canTrade;$('submit-order').textContent=canTrade?'Review order':state.eligible===false?'Trading unavailable for this wallet':'Connect and fund account to trade';for(const id of ['wrap','unwrap'])$(id).disabled=!state.wallet;$('deposit').disabled=!state.wallet||state.eligible!==true;$('withdraw').disabled=!state.wallet||!state.subAccountId;}

function renderPrice(price){
  state.price=price;
  $('last-price').textContent=number(price.lastPrice);
  $('mark').textContent=number(price.markPrice);
  $('index').textContent=number(price.indexPrice);
  $('volume').textContent=`${number(price.volume24h,1)} ETH`;
  $('funding').textContent=`${number(Number(price.fundingRate)*100,4)}%`;
  const change=(Number(price.lastPrice)/Number(price.prevDayPrice)-1)*100;
  $('change').textContent=`${change>=0?'+':''}${number(change)}% in 24h`;
  $('change').style.color=change>=0?'#57e5b9':'#ed89ac';
  estimate();
}
function estimate(){
  const size=Number($('size').value),price=Number(state.type==='limitGtc'?$('limit-price').value:state.price?.lastPrice),lev=Number($('leverage').value);
  $('leverage-text').textContent=`${lev}×`;
  const notional=size>0&&price>0?size*price:0;
  $('notional').textContent=notional?`${number(notional)} USDT`:'—';
  $('margin-estimate').textContent=notional?`≥ ${number(notional/lev)} USDT`:'—';
}
function renderBook(data){
  const asks=data.asks?.slice(0,9).reverse()||[],bids=data.bids?.slice(0,9)||[];
  const largest=Math.max(1,...asks.map(x=>Number(x[1])),...bids.map(x=>Number(x[1])));
  for(const [id,items,kind] of [['asks',asks,'ask'],['bids',bids,'bid']]){
    const node=$(id);node.replaceChildren();
    for(const [price,size] of items){const row=document.createElement('div');row.className=`level ${kind}`;row.style.setProperty('--depth',`${Math.max(2,Number(size)/largest*100)}%`);row.style.setProperty('--depth-color',kind==='ask'?'#d85a88':'#42daae');const p=document.createElement('span'),s=document.createElement('span');p.textContent=number(price);s.textContent=number(size,4);row.append(p,s);node.append(row);}
  }
  const bestBid=Number(data.bids?.[0]?.[0]),bestAsk=Number(data.asks?.[0]?.[0]);
  $('mid').textContent=bestBid&&bestAsk?number((bestBid+bestAsk)/2):'—';
  $('spread').textContent=bestBid&&bestAsk?`Spread ${number(bestAsk-bestBid)}`:'Spread —';
  status('book-status','Live');
}
function svg(tag,attrs={}){const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value] of Object.entries(attrs))el.setAttribute(key,String(value));return el;}
function renderChart(data){
  const candles=(data.candles||[]).slice().reverse().filter(c=>Number.isFinite(Number(c.highPrice)));
  const root=$('chart');root.replaceChildren();if(!candles.length){status('chart-status','No candles available');return;}
  const W=900,H=430,left=30,right=75,top=22,bottom=40;
  let low=Math.min(...candles.map(c=>Number(c.lowPrice))),high=Math.max(...candles.map(c=>Number(c.highPrice)));
  const padding=Math.max(1,(high-low)*.08);low-=padding;high+=padding;
  const y=v=>top+(high-Number(v))/(high-low)*(H-top-bottom);
  for(let i=0;i<5;i++){const value=low+(high-low)*i/4, yy=y(value);root.append(svg('line',{x1:left,y1:yy,x2:W-right,y2:yy,class:'chart-grid'}));const label=svg('text',{x:W-right+8,y:yy+4,class:'chart-label'});label.textContent=number(value);root.append(label);}
  const step=(W-left-right)/candles.length,bodyWidth=Math.max(3,Math.min(12,step*.62));
  candles.forEach((c,i)=>{const x=left+(i+.5)*step,up=Number(c.closePrice)>=Number(c.openPrice),klass=up?'candle-up':'candle-down';root.append(svg('line',{x1:x,y1:y(c.highPrice),x2:x,y2:y(c.lowPrice),class:klass,'stroke-width':1.5}));root.append(svg('rect',{x:x-bodyWidth/2,y:Math.min(y(c.openPrice),y(c.closePrice)),width:bodyWidth,height:Math.max(1,Math.abs(y(c.openPrice)-y(c.closePrice))),class:klass}));});
  for(let i=0;i<4;i++){const candle=candles[Math.min(candles.length-1,Math.round(i*(candles.length-1)/3))];const label=svg('text',{x:left+i*(W-left-right)/3,y:H-10,class:'chart-label','text-anchor':i===0?'start':i===3?'end':'middle'});label.textContent=new Date(candle.openTime).toLocaleDateString('en-US',{month:'short',day:'numeric'});root.append(label);}
  root.setAttribute('aria-label',`ETH-USDT candles from ${new Date(candles[0].openTime).toLocaleString()} to ${new Date(candles.at(-1).openTime).toLocaleString()}`);
  status('chart-status',`${state.interval} candles · live feed`);
}
async function refreshMarket(){
  try{
    const [markets,prices,book]=await Promise.all([perpsRequest({action:'getMarkets'}),perpsRequest({action:'getMarketPrices'}),perpsRequest({action:'getOrderbook',symbol:'ETH-USDT'})]);
    state.market=markets.find(m=>m.symbol==='ETH-USDT');
    const price=prices['ETH-USDT'];if(!state.market||!price)throw new Error('ETH market is unavailable');
    if(!Number.isFinite(Number(price.timestamp))||Date.now()-Number(price.timestamp)>60000||Number(price.timestamp)>Date.now()+5000)throw new Error('Market data is stale');
    state.marketUpdatedAt=Date.now();
    renderPrice(price);renderBook(book);
    $('market-state').textContent=state.market.isOpen?(state.market.isCloseOnly?'Close only':'Open'):'Closed';
    $('leverage').max=Math.min(25,Number(state.market.maintenanceMarginTiers?.[0]?.maxLeverage)||25);
    $('size').min=state.market.minOrderSize||'0.01';estimate();ready();
  }catch(e){state.marketUpdatedAt=0;state.market=null;state.price=null;status('book-status','Unavailable');status('chart-status',e.message);$('market-state').textContent='Unavailable';ready();}
}
async function refreshCandles(){try{const data=await perpsRequest({action:'getCandles',symbol:'ETH-USDT',interval:state.interval,limit:80});renderChart(data);}catch(e){status('chart-status',e.message);}}
function setSide(side){state.side=side;for(const [id,value] of [['long','buy'],['short','sell']])$(id).classList.toggle('selected',side===value);}
function setType(type){state.type=type;$('market-order').classList.toggle('selected',type==='market');$('limit-order').classList.toggle('selected',type==='limitGtc');$('limit-label').hidden=type==='market';$('limit-price').hidden=type==='market';$('limit-price').required=type==='limitGtc';estimate();}

async function connect(){
  try{
    const provider=window.ethereum;if(!provider)throw new Error('Install an Ethereum browser wallet to connect');
    state.wallet=await connectWallet(provider);$('connect').textContent=`${state.wallet.address.slice(0,6)}…${state.wallet.address.slice(-4)}`;$('wallet-address').textContent=`${state.wallet.address.slice(0,6)}…${state.wallet.address.slice(-4)}`;
    status('trade-status','Wallet connected. Checking Synthetix accounts.');
    await refreshWallet();await discoverAccounts();
    if(provider.on){provider.on('accountsChanged',()=>location.reload());provider.on('chainChanged',()=>location.reload());}
  }catch(e){status('trade-status',e.message);}finally{ready();}
}
async function refreshWallet(){if(!state.wallet)return;try{const b=await walletBalances(state.wallet);$('eth-balance').textContent=`${number(b.eth,5)} ETH`;$('weth-balance').textContent=`${number(b.weth,5)} WETH`;}catch(e){status('collateral-status',e.message);}}
async function checkEligibility(){
  const eligible=await perpsRequest({action:'getIsWhitelisted',walletAddress:getAddress(state.wallet.address)});
  if(typeof eligible!=='boolean')throw new Error('Unable to verify Synthetix trading access');
  state.eligible=eligible;
  $('trading-access').textContent=eligible?'Eligible':'Unavailable';
  ready();
  return eligible;
}
async function discoverAccounts(){
  if(!state.wallet)return;
  try{
    await checkEligibility();
    const ids=await perpsRequest({action:'getSubAccountIds',walletAddress:getAddress(state.wallet.address)});
    state.subAccountId=Array.isArray(ids)?ids[0]:ids?.subAccountIds?.[0];
    $('account-id').textContent=state.subAccountId?`#${state.subAccountId}`:'No account yet';
    if(state.subAccountId){const refreshed=await refreshAccount();if(refreshed)status('trade-status',state.eligible?'Account ready. Review risk before placing a trade.':'Synthetix does not permit this wallet to trade. Existing collateral may still be withdrawn.');}
    else status('trade-status',state.eligible?'No Synthetix account. Wrap ETH and deposit WETH to create one.':'Synthetix does not permit this wallet to trade. Do not deposit.');
  }catch(e){state.eligible=null;$('trading-access').textContent='Unknown';status('trade-status',`Trading access check: ${e.message}`);}finally{ready();}
}
function cell(row,value){const td=document.createElement('td');td.textContent=String(value??'—');row.append(td);return td;}
function renderAccount(){
  const node=$('account-content');node.replaceChildren();
  const entries=state.tab==='positions'?state.positions:state.orders;
  if(!entries.length){const p=document.createElement('p');p.className='empty';p.textContent=state.tab==='positions'?'No open ETH positions.':'No open ETH orders.';node.append(p);return;}
  const table=document.createElement('table');table.className='data-table';const head=document.createElement('tr');for(const label of state.tab==='positions'?['Market','Side','Size','Entry','Mark','Liq. price','Unrealized PnL','Action']:['Market','Side','Type','Price','Remaining','Action']){const th=document.createElement('th');th.textContent=label;head.append(th);}table.append(head);
  for(const item of entries){const row=document.createElement('tr');if(state.tab==='positions'){cell(row,item.symbol);cell(row,item.side);cell(row,item.quantity);cell(row,item.entryPrice);cell(row,state.price?.markPrice);cell(row,item.liquidationPrice);cell(row,item.unrealizedPnl);const action=cell(row,'');const button=document.createElement('button');button.textContent='Close';button.addEventListener('click',()=>closePosition(item));action.append(button);}else{cell(row,item.symbol);cell(row,item.side);cell(row,item.orderType||item.type);cell(row,item.price);cell(row,Math.max(0,Number(item.quantity)-Number(item.filledQuantity||0)));const action=cell(row,'');const button=document.createElement('button');button.textContent='Cancel';button.addEventListener('click',()=>cancel(item.order?.venueId||item.orderId));action.append(button);}table.append(row);}node.append(table);
}
async function refreshAccount(){
  if(!state.wallet||!state.subAccountId)return;
  try{
    status('trade-status','Sign read requests to refresh account data.');
    const account=await accountRequest(state.wallet.signer,state.subAccountId,'getSubAccount');
    $('available-margin').textContent=`${number(account.crossMarginSummary?.availableMargin||0)} USDT`;
    $('account-value').textContent=`${number(account.crossMarginSummary?.accountValue||0)} USDT`;
    const weth=account.collaterals?.find(c=>c.symbol==='WETH');
    $('venue-weth').textContent=weth?`${number(weth.quantity,5)} WETH`:'0 WETH';
    const positions=await accountRequest(state.wallet.signer,state.subAccountId,'getPositions',{symbol:'ETH-USDT',status:'open'});
    const orders=await accountRequest(state.wallet.signer,state.subAccountId,'getOpenOrders',{symbol:'ETH-USDT'});
    state.positions=openEthPositions(positions);
    state.orders=openEthOrders(orders);
    renderAccount();status('trade-status','Account data refreshed.');return true;
  }catch(e){status('trade-status',`Account refresh: ${e.message}`);return false;}
}
async function submit(event){
  event.preventDefault();if(!state.wallet||!state.subAccountId)return;
  const button=$('submit-order');button.disabled=true;
  try{
    if(!await checkEligibility())throw new Error('Synthetix does not permit this wallet to trade');
    const order=makeOrder({side:state.side,type:state.type,size:$('size').value,limitPrice:$('limit-price').value});
    if(!state.market?.isOpen||state.market.isCloseOnly)throw new Error('ETH market is closed or close only');
    if(Number(order.quantity)<Number(state.market.minOrderSize||'0.01'))throw new Error(`Minimum ETH order size is ${state.market.minOrderSize}`);
    const max=Number(state.market?.maintenanceMarginTiers?.[0]?.maxLeverage||25),leverage=Number($('leverage').value);
    if(leverage>max)throw new Error(`Maximum leverage is ${max}×`);
    const price=Number(order.price||state.price?.lastPrice||0),notional=price*Number(order.quantity);
    if(!price||!Number.isFinite(notional)||Date.now()-state.marketUpdatedAt>60000)throw new Error('Live price unavailable or stale');
    const side=order.side==='buy'?'Long':'Short',detail=`${side} ${order.quantity} ETH at ${order.orderType==='market'?'market price':`${order.price} USDT`}, ${leverage}× leverage. Approximate notional ${number(notional)} USDT. Fees, funding and liquidation risk apply.`;
    if(!window.confirm(`Submit a REAL Ethereum Mainnet perpetual order to Synthetix?\n\n${detail}`))return;
    status('trade-status','Set leverage in Synthetix. Review the wallet signature.');
    await setLeverage(state.wallet.signer,state.subAccountId,leverage);
    status('trade-status','Sign the order request in your wallet.');
    const response=await placeOrder(state.wallet.signer,state.subAccountId,order);
    const outcome=orderOutcome(response);
    const refreshed=await refreshAccount();
    status('trade-status',`${outcome.label}. ${refreshed?'Review current positions and orders.':'Account refresh failed; verify the outcome at Synthetix before retrying.'}`);
  }catch(e){status('trade-status',e.message);}finally{ready();}
}
async function cancel(orderId){if(!orderId||!state.wallet||!state.subAccountId)return;if(!window.confirm(`Cancel Synthetix order ${orderId}?`))return;try{status('trade-status','Sign cancellation in your wallet.');await cancelOrder(state.wallet.signer,state.subAccountId,orderId);const refreshed=await refreshAccount();status('trade-status',refreshed?`Cancellation submitted. ${state.orders.some(x=>(x.order?.venueId||x.orderId)===orderId)?'Order still appears open; check again before assuming cancellation.':'Order no longer appears open.'}`:'Cancellation submitted; account refresh failed. Verify at Synthetix.');}catch(e){status('trade-status',e.message);}}
async function closePosition(position){
  if(!state.wallet||!state.subAccountId)return;
  const size=String(Math.abs(Number(position.quantity||position.size||0)));
  const positionSide=String(position.side||'').toLowerCase();
  const side=positionSide.includes('long')||positionSide==='buy'?'sell':positionSide.includes('short')||positionSide==='sell'?'buy':null;
  if(!side){status('trade-status','Unable to determine position direction. Use Synthetix to close this position.');return;}
  let order;
  try{order=makeOrder({side,type:'market',size,reduceOnly:true});}catch(e){status('trade-status',e.message);return;}
  if(!window.confirm(`Close ${size} ETH ${position.side} on Synthetix with a reduce-only market order? This is a real-money trade.`))return;
  try{status('trade-status','Sign reduce-only close order.');const result=await placeOrder(state.wallet.signer,state.subAccountId,order);const outcome=orderOutcome(result);const refreshed=await refreshAccount();status('trade-status',`${outcome.label}. ${refreshed?'Review the position to confirm closure.':'Account refresh failed; verify at Synthetix before retrying.'}`);}catch(e){status('trade-status',e.message);}
}
async function collateral(kind){
  if(!state.wallet)return;const amount=$('collateral-amount').value;
  const descriptions={wrap:`Wrap ${amount} ETH into WETH in your wallet`,deposit:`Deposit ${amount} WETH into Synthetix custody`,withdraw:`Withdraw ${amount} WETH from Synthetix to your wallet`,unwrap:`Unwrap ${amount} WETH into ETH in your wallet`};
  if(!window.confirm(`${descriptions[kind]} on Ethereum Mainnet? Fees and gas may apply.`))return;
  for(const id of ['wrap','deposit','withdraw','unwrap'])$(id).disabled=true;
  try{
    status('collateral-status','Review the request in your wallet.');
    if(kind==='deposit'&&!await checkEligibility())throw new Error('Synthetix does not permit this wallet to trade. Deposit is disabled.');
    if(kind==='withdraw'){await withdrawWeth(state.wallet.signer,state.subAccountId,state.wallet.address,amount);status('collateral-status','Withdrawal request accepted. Refresh account and wallet balances after settlement.');await refreshAccount();return;}
    const hash=kind==='wrap'?await wrapEth(state.wallet,amount):kind==='deposit'?await depositWeth(state.wallet,amount,state.subAccountId||0):await unwrapWeth(state.wallet,amount);
    status('collateral-status',`Confirmed: ${hash.slice(0,12)}… Refreshing balances.`);await refreshWallet();if(kind==='deposit')await discoverAccounts();
  }catch(e){status('collateral-status',e.message);}finally{ready();}
}

$('connect').addEventListener('click',connect);
$('long').addEventListener('click',()=>setSide('buy'));
$('short').addEventListener('click',()=>setSide('sell'));
$('market-order').addEventListener('click',()=>setType('market'));
$('limit-order').addEventListener('click',()=>setType('limitGtc'));
for(const id of ['size','limit-price','leverage'])$(id).addEventListener('input',estimate);
for(const button of document.querySelectorAll('[data-interval]'))button.addEventListener('click',()=>{state.interval=button.dataset.interval;document.querySelectorAll('[data-interval]').forEach(el=>el.classList.toggle('selected',el===button));refreshCandles();});
$('ticket').addEventListener('submit',submit);
$('refresh-account').addEventListener('click',()=>state.subAccountId?refreshAccount():discoverAccounts());
$('positions-tab').addEventListener('click',()=>{state.tab='positions';$('positions-tab').classList.add('selected');$('orders-tab').classList.remove('selected');renderAccount();});
$('orders-tab').addEventListener('click',()=>{state.tab='orders';$('orders-tab').classList.add('selected');$('positions-tab').classList.remove('selected');renderAccount();});
$('wrap').addEventListener('click',()=>collateral('wrap'));
$('deposit').addEventListener('click',()=>collateral('deposit'));
$('withdraw').addEventListener('click',()=>collateral('withdraw'));
$('unwrap').addEventListener('click',()=>collateral('unwrap'));
ready();refreshMarket();refreshCandles();setInterval(refreshMarket,20000);
