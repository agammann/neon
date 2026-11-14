import {seeded} from './engine.js';
let exchange=seeded(),side='buy';
const $=id=>document.getElementById(id);
const number=(n,max=6)=>new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:max}).format(n);
const money=n=>number(n/1e6)+' USDT';
const price=n=>number(n/100)+' USDT';
const eth=n=>(n/1000).toFixed(3);
const owner=()=>$('owner').value;
function feedback(message,error=false){$('feedback').textContent=message;$('feedback').classList.toggle('error',error);}
function form(){
 const p=Number($('price').value),q=Number($('quantity').value);
 $('total').textContent=Number.isFinite(p*q)?number(p*q)+' USDT':'Enter a valid amount';
 const a=exchange.available(owner());$('available').textContent=`Available: ${money(a.cash)} · ${eth(a.asset)} demo ETH`;
 $('submit').textContent=`Place ${side} order`;$('submit').classList.toggle('selling',side==='sell');
 for(const s of ['buy','sell'])$(s).setAttribute('aria-pressed',String(s===side));
}
function chart(){
 const prices=exchange.trades.map(t=>t.price),last=prices.at(-1)??325000;
 $('chart-price').textContent=price(last);$('chart-caption').textContent=prices.length?`${prices.length} executed fill${prices.length===1?'':'s'} · Simulated session prices`:'Synthetic reference price · execute a trade to begin';
 const values=[325000,...prices.slice(-39)],low=Math.min(...values)-30,high=Math.max(...values)+30;
 const y=p=>200-(p-low)/(high-low)*170;
 const points=values.map((p,i)=>`${30+i*470/Math.max(values.length-1,1)},${y(p)}`).join(' ');
 let grid='';for(let i=0;i<5;i++){const yy=25+i*43;grid+=`<line x1="20" y1="${yy}" x2="500" y2="${yy}" stroke="#273342" stroke-dasharray="3 5"/><text x="505" y="${yy+4}" fill="#8f9fb3" font-size="12">${((high-i*(high-low)/4)/100).toFixed(2)}</text>`;}
 $('chart').innerHTML=`<svg viewBox="0 0 600 230" role="img" aria-label="Simulated execution prices. ${prices.length} trades. Last ${price(last)}"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#56f5d3" stop-opacity=".24"/><stop offset="1" stop-color="#56f5d3" stop-opacity="0"/></linearGradient></defs>${grid}<polygon points="30,210 ${points} ${values.length>1?500:30},210" fill="url(#area)"/><polyline points="${points}" fill="none" stroke="#56f5d3" stroke-width="2.5"/>${values.map((p,i)=>`<circle cx="${30+i*470/Math.max(values.length-1,1)}" cy="${y(p)}" r="4" fill="#56f5d3"/>`).join('')}<text x="25" y="229" fill="#8f9fb3" font-size="12">REFERENCE</text><text x="430" y="229" fill="#8f9fb3" font-size="12">LATEST</text>${prices.length?'':'<text x="160" y="80" fill="#a8bbcb" font-size="14">Your first trade starts the chart</text>'}</svg>`;
}
function render(){
 const bids=exchange.book('buy'),asks=exchange.book('sell');
 $('bid').textContent=bids.length?price(bids[0].price):'No bids';$('ask').textContent=asks.length?price(asks[0].price):'No asks';
 $('spread').textContent=bids.length&&asks.length?price(asks[0].price-bids[0].price):'No two sided market';
 $('last').textContent=exchange.trades.length?price(exchange.trades.at(-1).price):'No trades yet';
 $('volume').textContent=eth(exchange.trades.reduce((n,t)=>n+t.quantity,0))+' ETH';
 for(const [id,orders,cls] of [['asks',asks.slice(0,5).reverse(),'ask'],['bids',bids.slice(0,5),'bid']])$(id).innerHTML=orders.length?orders.map(o=>`<div class="book-row ${cls}" style="--depth:${Math.min(o.remaining/2,100)}%"><span>${(o.price/100).toFixed(2)}</span><span>${eth(o.remaining)}</span><span>${o.owner}</span></div>`).join(''):'<p class="empty">No resting orders</p>';
 $('accounts').innerHTML=Object.entries(exchange.accounts).map(([name,a])=>{const v=exchange.available(name);return `<article class="account"><div class="account-top"><span class="avatar">${name[0]}</span><h3>${name}</h3><small>SIMULATED ACCOUNT</small></div><div class="balances"><div><span class="label">DEMO USDT</span><strong>${number(a.cash/1e6)}</strong><p>${money(v.cash)} available<br>${money(a.cash-v.cash)} reserved</p></div><div><span class="label">DEMO ETH</span><strong>${eth(a.asset)}</strong><p>${eth(v.asset)} available<br>${eth(a.asset-v.asset)} reserved</p></div></div></article>`;}).join('');
 $('trades').innerHTML=exchange.trades.length?exchange.trades.slice(-30).reverse().map(t=>`<tr><td>#${String(t.id).padStart(3,'0')}</td><td>${t.buyer} → ${t.seller}</td><td>${number(t.price/100)}</td><td>${eth(t.quantity)}</td><td>${number(t.value/1e6)}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">No trades yet.<br>Place a crossing order or run the Bob + Alice demo.</td></tr>';
 $('trade-count').textContent=exchange.trades.length+' FILLS';$('orders-for').textContent=owner()+'’s orders';
 const orders=exchange.orders.filter(o=>o.owner===owner()&&o.status==='open');
 $('orders').innerHTML=orders.length?orders.map(o=>`<tr><td>#${String(o.id).padStart(3,'0')}</td><td class="${o.side==='buy'?'bid':'ask'}">${o.side.toUpperCase()}</td><td>${price(o.price)}</td><td>${eth(o.remaining)} / ${eth(o.quantity)}</td><td><button data-cancel="${o.id}" aria-label="Cancel order ${o.id}">Cancel</button></td></tr>`).join(''):'<tr><td colspan="5" class="empty">No open orders for this participant.</td></tr>';
 $('events').innerHTML=exchange.events.slice(-60).reverse().map(e=>`<div class="event"><span>${String(e.sequence).padStart(4,'0')}</span><b>${e.type.toUpperCase()}</b>${e.detail}</div>`).join('');form();chart();
}
function place(input){const order=exchange.place(input);render();const filled=order.quantity-order.remaining;feedback(filled?`${input.owner}: ${eth(filled)} ETH filled. ${eth(order.remaining)} remaining on the order book.`:`Order #${order.id} accepted. Waiting for a matching ${input.side==='buy'?'sell':'buy'} order.`);return {order,...exchange.snapshot()};}
$('order-form').addEventListener('submit',e=>{e.preventDefault();try{const p=$('price').value,q=$('quantity').value;if(!/^\d+(\.\d{1,2})?$/.test(p))throw Error('Use a price with at most two decimal places.');if(!/^\d+(\.\d{1,3})?$/.test(q))throw Error('Use an ETH quantity with at most three decimal places.');place({owner:owner(),side,price:Math.round(Number(p)*100),quantity:Math.round(Number(q)*1000)});}catch(e){feedback(e.message,true);}});
for(const s of ['buy','sell'])$(s).onclick=()=>{side=s;form();};$('owner').onchange=render;for(const id of ['price','quantity'])$(id).oninput=form;
$('orders').onclick=e=>{const b=e.target.closest('[data-cancel]');if(b){try{exchange.cancel(owner(),Number(b.dataset.cancel));render();feedback('Order cancelled. Reserved balance is available again.');}catch(e){feedback(e.message,true);}}};
$('reset').onclick=()=>$('reset-dialog').showModal();$('keep').onclick=()=>$('reset-dialog').close();$('confirm-reset').onclick=()=>{exchange=seeded();render();feedback('Session reset. Bob and Alice each start with 10,000 USDT and 2 ETH.');$('reset-dialog').close();};
$('demo').onclick=()=>{exchange=seeded();$('owner').value='Bob';side='buy';$('price').value='3250.00';$('quantity').value='0.05';place({owner:'Bob',side:'buy',price:325000,quantity:50});feedback('Demo complete: Bob bought 0.050 ETH from Alice for 162.50 USDT. Alice’s remaining ask is 0.070 ETH. This button starts a fresh demo session.');};
for(const mode of ['demo','wallet'])$('mode-'+mode).onclick=()=>{for(const m of ['demo','wallet']){$(m+'-surface').hidden=m!==mode;$('mode-'+m).setAttribute('aria-pressed',String(m===mode));}document.querySelector('.badge').textContent=mode==='demo'?'SIMULATED MARKET':(document.body.dataset.networkName||'ETHEREUM MAINNET');};
render();
if(document.modelContext?.registerTool){const life=new AbortController();const register=tool=>{try{Promise.resolve(document.modelContext.registerTool(tool,{signal:life.signal})).catch(()=>{});}catch{}};
register({name:'read_exchange',description:'Read simulated balances, orders, trades, and events. Cash is microUSDT, quantities are milliETH, prices are USDT cents per ETH. No wallet data.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>exchange.snapshot()});
register({name:'place_simulated_order',description:'Place a simulated ETH limit order. Price is USDT cents per ETH; quantity is milliETH. Does not transact real funds.',inputSchema:{type:'object',properties:{owner:{enum:['Bob','Alice']},side:{enum:['buy','sell']},price:{type:'integer',minimum:1,maximum:10000000},quantity:{type:'integer',minimum:1,maximum:100000}},required:['owner','side','price','quantity'],additionalProperties:false},annotations:{readOnlyHint:false},execute:input=>{try{return place(input);}catch(e){feedback(e.message,true);return {error:e.message};}}});
// Cached pages keep their registrations and exchange state when restored.
window.addEventListener('pagehide',event=>{if(!event.persisted)life.abort();});}

$('mode-wallet').click();
