const $=id=>document.getElementById(id);
let current=null,busy=false;
const short=value=>`${value.slice(0,6)}…${value.slice(-4)}`;
const eth=value=>`${Number(value).toLocaleString('en-US',{maximumFractionDigits:6})} ETH`;
const note=(message,error=false)=>{$('message').textContent=message;$('message').classList.toggle('error',error);};
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=String(text);return node;};
function actionButton(label,payload){const button=el('button','',label);button.addEventListener('click',()=>act(payload));return button;}
function render(data){
  current=data;$('price').textContent=data.price==null?'Oracle stale':`$${data.price.toLocaleString('en-US',{minimumFractionDigits:2})}`;
  $('contract').textContent=`Contract ${short(data.contract)}`;
  const traders=$('traders');traders.replaceChildren();
  for(const name of ['Alice','Bob']){
    const trader=data.balances[name],card=el('article','trader'),title=el('h3','',name),address=el('div','address',trader.address),wallet=el('div','balance'),margin=el('div','balance'),buttons=el('div','actions');
    wallet.append(el('span','','Wallet test ETH'),el('strong','',eth(trader.wallet)));
    margin.append(el('span','','Available margin'),el('strong','',eth(trader.available)));
    buttons.append(actionButton('Deposit 1 ETH',{action:'deposit',actor:name,amount:'1'}),actionButton('Withdraw all',{action:'withdraw',actor:name,amount:'all'}));
    card.append(title,address,wallet,margin,buttons);traders.append(card);
  }
  const offerRoot=$('offers');offerRoot.replaceChildren();
  const active=data.offers.filter(o=>o.active);
  if(!active.length)offerRoot.append(el('p','empty','No open offers. Deposit and post one above.'));
  for(const offer of active){
    const maker=Object.keys(data.balances).find(name=>data.balances[name].address.toLowerCase()===offer.maker.toLowerCase()),other=maker==='Alice'?'Bob':'Alice';
    const row=el('article','row'),head=el('div'),detail=el('small','',`${eth(offer.margin)} each · ${offer.leverage}× · reference $${offer.referencePrice.toLocaleString()}`),buttons=el('div','actions');
    head.append(el('strong','',`#${offer.id} · ${maker} ${offer.makerIsLong?'long':'short'}`),el('small','',`Expires ${new Date(offer.expiresAt).toLocaleTimeString()}`));
    buttons.append(actionButton(`${other} match`,{action:'match',actor:other,id:offer.id,price:data.price}),actionButton('Cancel',{action:'cancel',actor:maker,id:offer.id}));
    row.append(head,detail,buttons);offerRoot.append(row);
  }
  const positionRoot=$('positions');positionRoot.replaceChildren();
  const positions=data.positions.filter(p=>p.active);
  if(!positions.length)positionRoot.append(el('p','empty','No open positions. Match an offer to open one.'));
  for(const position of positions){
    const longName=Object.keys(data.balances).find(name=>data.balances[name].address.toLowerCase()===position.longTrader.toLowerCase());
    const shortName=longName==='Alice'?'Bob':'Alice';
    const row=el('article','row'),head=el('div'),buttons=el('div','actions');
    head.append(el('strong','',`#${position.id} · ${longName} long / ${shortName} short`),el('small','',`${position.leverage}×`));
    buttons.append(actionButton(`${longName} close`,{action:'close',actor:longName,id:position.id}),actionButton(`${shortName} close`,{action:'close',actor:shortName,id:position.id}),actionButton('Liquidate if eligible',{action:'liquidate',id:position.id}),actionButton('Stale refund',{action:'refund',id:position.id}));
    row.append(head,el('small','',`${eth(position.margin)} each · entry $${position.entryPrice.toLocaleString()}`),buttons);positionRoot.append(row);
  }
  const events=$('events');events.replaceChildren();
  if(!data.events.length)events.append(el('p','empty','Contract transactions will appear here.'));
  for(const event of data.events.slice().reverse()){
    const row=el('div','event');row.append(el('strong','',event.name),el('span','',short(event.transactionHash)));events.append(row);
  }
}
async function refresh(){try{const response=await fetch('/api/state');const data=await response.json();if(!response.ok)throw new Error(data.error||'Lab unavailable');render(data);}catch(e){note(e.message,true);}}
async function act(payload){
  if(busy)return;busy=true;document.querySelectorAll('button').forEach(button=>button.disabled=true);note('Mining transaction on the disposable local chain…');
  try{
    const response=await fetch('/api/action',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    const data=await response.json();if(!response.ok)throw new Error(data.error||'Transaction failed');render(data.state);
    note(data.hash?`${data.message} · ${short(data.hash)}`:data.message);
  }catch(e){note(e.message,true);}finally{busy=false;document.querySelectorAll('button').forEach(button=>button.disabled=false);}
}
$('post').addEventListener('click',()=>act({action:'post',actor:$('maker').value,side:$('side').value,amount:$('margin').value,leverage:Number($('leverage').value)}));
$('set-price').addEventListener('click',()=>act({action:'setPrice',price:Number($('new-price').value)}));
$('reset').addEventListener('click',()=>{if(window.confirm('Reset all disposable test-chain transactions?'))act({action:'reset'});});
refresh();setInterval(()=>{if(!busy)refresh();},5000);
