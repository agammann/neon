import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import ganache from 'ganache';
import {BrowserProvider,ContractFactory,formatEther,parseEther} from 'ethers';
import {compileNativeMarket} from './compile.mjs';

const root=dirname(fileURLToPath(import.meta.url));
const port=Number(process.env.NEON_NATIVE_PORT||4322);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid local lab port');
const chain=ganache.provider({chain:{chainId:31337},wallet:{totalAccounts:3,defaultBalance:100},logging:{quiet:true}});
const provider=new BrowserProvider(chain);
const [alice,bob,carol]=await Promise.all([provider.getSigner(0),provider.getSigner(1),provider.getSigner(2)]);
const built=await compileNativeMarket();
const oracle=await new ContractFactory(built.oracle.abi,built.oracle.evm.bytecode.object,alice).deploy(2000n*100000000n);
await oracle.waitForDeployment();
const market=await new ContractFactory(built.market.abi,built.market.evm.bytecode.object,alice).deploy(await oracle.getAddress());
await market.waitForDeployment();
let initialSnapshot=await chain.request({method:'evm_snapshot',params:[]});
const actors={Alice:alice,Bob:bob};

const json=(value,status=200)=>({status,body:JSON.stringify(value),type:'application/json; charset=utf-8'});
const fixed8=value=>Number(value)/1e8;
async function state(){
  const balances={};
  for(const [name,signer] of Object.entries(actors)){
    const address=await signer.getAddress();
    balances[name]={address,available:formatEther(await market.availableWei(address)),wallet:formatEther(BigInt(await chain.request({method:'eth_getBalance',params:[address,'latest']})))};
  }
  const offers=[];
  for(let id=1n;id<await market.nextOfferId();id++){
    const offer=await market.offers(id);
    offers.push({id:String(id),maker:offer.maker,makerIsLong:offer.makerIsLong,margin:formatEther(offer.marginWei),leverage:Number(offer.leverage),referencePrice:fixed8(offer.referencePrice8),active:offer.active,expiresAt:Number(offer.expiresAt)*1000});
  }
  const positions=[];
  for(let id=1n;id<await market.nextPositionId();id++){
    const position=await market.positions(id);
    positions.push({id:String(id),longTrader:position.longTrader,shortTrader:position.shortTrader,margin:formatEther(position.marginWei),entryPrice:fixed8(position.entryPrice8),leverage:Number(position.leverage),active:position.active});
  }
  const logs=await chain.request({method:'eth_getLogs',params:[{address:await market.getAddress(),fromBlock:'0x0',toBlock:'latest'}]});
  const events=logs.slice(-30).map(log=>{
    const parsed=market.interface.parseLog(log);
    return {name:parsed.name,args:parsed.args.map(value=>typeof value==='bigint'?value.toString():value),transactionHash:log.transactionHash};
  });
  let price=null;try{price=fixed8(await market.currentPrice8());}catch{} // Keep the stale-refund controls usable during an oracle outage.
  return {chainId:31337,contract:await market.getAddress(),oracle:await oracle.getAddress(),price,balances,offers,positions,events};
}

function amount(input){
  if(typeof input!=='string'||!/^\d{1,2}(?:\.\d{1,6})?$/.test(input))throw new Error('Enter 0.01 to 10 ETH with at most 6 decimals');
  const wei=parseEther(input);
  if(wei<parseEther('0.01')||wei>parseEther('10'))throw new Error('Enter 0.01 to 10 ETH');
  return wei;
}
async function transact(body){
  if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('Invalid action');
  const signer=actors[body.actor];
  if(body.action!=='setPrice'&&body.action!=='reset'&&!signer)throw new Error('Choose Alice or Bob');
  let tx;
  switch(body.action){
    case 'deposit': tx=await market.connect(signer).deposit({value:amount(body.amount)});break;
    case 'withdraw': tx=await market.connect(signer).withdraw(body.amount==='all'?await market.availableWei(await signer.getAddress()):amount(body.amount));break;
    case 'post':{
      if(!['long','short'].includes(body.side)||!Number.isInteger(body.leverage)||body.leverage<1||body.leverage>5)throw new Error('Choose long or short and 1–5× leverage');
      const latest=await provider.getBlock('latest');
      tx=await market.connect(signer).postOffer(body.side==='long',amount(body.amount),body.leverage,latest.timestamp+3600,100);
      break;
    }
    case 'match':{
      const expected=Number(body.price);
      if(!Number.isFinite(expected)||expected<100||expected>100000)throw new Error('Refresh a valid test price before matching');
      const price8=BigInt(Math.round(expected*1e8));
      tx=await market.connect(signer).matchOffer(String(body.id),price8*9950n/10000n,price8*10050n/10000n);
      break;
    }
    case 'cancel':tx=await market.connect(signer).cancelOffer(String(body.id));break;
    case 'close':tx=await market.connect(signer).closePosition(String(body.id));break;
    case 'liquidate':tx=await market.connect(carol).liquidate(String(body.id));break;
    case 'refund':tx=await market.connect(carol).refundStalePosition(String(body.id));break;
    case 'setPrice':{
      const value=Number(body.price);
      if(!Number.isInteger(value)||value<100||value>100000)throw new Error('Choose a test price from $100 to $100,000');
      tx=await oracle.setPrice(BigInt(value)*100000000n);break;
    }
    case 'reset':{
      await chain.request({method:'evm_revert',params:[initialSnapshot]});
      initialSnapshot=await chain.request({method:'evm_snapshot',params:[]});
      return {message:'Local chain reset',state:await state()};
    }
    default:throw new Error('Unsupported action');
  }
  const receipt=await tx.wait();
  if(receipt.status!==1)throw new Error('Local transaction reverted');
  return {message:'Confirmed on disposable local chain',hash:tx.hash,state:await state()};
}

createServer(async(req,res)=>{
  const origin=req.headers.origin;
  if(origin&&origin!==`http://127.0.0.1:${port}`){res.writeHead(403);res.end('Forbidden');return;}
  const url=new URL(req.url,`http://127.0.0.1:${port}`);
  try{
    let result;
    if(req.method==='GET'&&url.pathname==='/api/state')result=json(await state());
    else if(req.method==='POST'&&url.pathname==='/api/action'){
      if(!String(req.headers['content-type']||'').startsWith('application/json'))throw new Error('JSON required');
      let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192)throw new Error('Request too large');}
      result=json(await transact(JSON.parse(raw)));
    }else if(req.method==='GET'&&['/','/lab.js','/lab.css'].includes(url.pathname)){
      const file=url.pathname==='/'?'lab.html':url.pathname.slice(1);
      const type=file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8';
      result={status:200,body:await readFile(join(root,file)),type};
    }else result={status:404,body:'Not found',type:'text/plain'};
    res.writeHead(result.status,{'content-type':result.type,'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'"});res.end(result.body);
  }catch(e){const result=json({error:e.shortMessage||e.message||'Local action failed'},400);res.writeHead(result.status,{'content-type':result.type,'cache-control':'no-store'});res.end(result.body);}
}).listen(port,'127.0.0.1',()=>console.log(`Neon native ETH lab: http://127.0.0.1:${port}/`));
