import {BrowserProvider, Contract, Signature, getAddress, parseEther, formatEther} from 'ethers';

export const WETH = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';
export const DEPOSIT = '0xD62595c3c23B690BAEE0935e107A209Cb1Dbd37B';
export const DOMAIN = Object.freeze({name:'Synthetix',version:'1',chainId:1,verifyingContract:'0x0000000000000000000000000000000000000000'});
export const ORDER_TYPES = {
  Order:[{name:'symbol',type:'string'},{name:'side',type:'string'},{name:'orderType',type:'string'},{name:'price',type:'string'},{name:'triggerPrice',type:'string'},{name:'quantity',type:'string'},{name:'reduceOnly',type:'bool'},{name:'isTriggerMarket',type:'bool'},{name:'clientOrderId',type:'string'},{name:'closePosition',type:'bool'}],
  PlaceOrders:[{name:'subAccountId',type:'uint256'},{name:'orders',type:'Order[]'},{name:'grouping',type:'string'},{name:'nonce',type:'uint256'},{name:'expiresAfter',type:'uint256'}]
};
export const SUBACCOUNT_TYPES={SubAccountAction:[{name:'subAccountId',type:'uint256'},{name:'action',type:'string'},{name:'expiresAfter',type:'uint256'}]};
export const LEVERAGE_TYPES={UpdateLeverage:[{name:'subAccountId',type:'uint256'},{name:'symbol',type:'string'},{name:'leverage',type:'string'},{name:'nonce',type:'uint256'},{name:'expiresAfter',type:'uint256'}]};
export const CANCEL_TYPES={CancelOrders:[{name:'subAccountId',type:'uint256'},{name:'orderIds',type:'uint256[]'},{name:'nonce',type:'uint256'},{name:'expiresAfter',type:'uint256'}]};
export const WITHDRAW_TYPES={WithdrawCollateral:[{name:'subAccountId',type:'uint256'},{name:'symbol',type:'string'},{name:'amount',type:'string'},{name:'destination',type:'address'},{name:'nonce',type:'uint256'},{name:'expiresAfter',type:'uint256'}]};
let lastNonce=0;
export function nextNonce(){lastNonce=Math.max(Date.now(),lastNonce+1);return lastNonce;}
export function normalizeAmount(input,min='0'){
  const value=String(input).trim();
  if(!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)||!Number.isFinite(Number(value))||Number(value)<Number(min))throw new Error(`Enter an amount of at least ${min}`);
  return value;
}
export function makeOrder({side,type,size,limitPrice,reduceOnly=false}){
  const quantity=normalizeAmount(size,'0.01');
  if(!['buy','sell'].includes(side)||!['market','limitGtc'].includes(type))throw new Error('Invalid order side or type');
  const price=type==='limitGtc'?normalizeAmount(limitPrice,'0.1'):'';
  if(!/^\d+(?:\.\d{1,4})?$/.test(quantity))throw new Error('ETH size supports at most 4 decimals');
  if(price && !/^\d+(?:\.\d)?$/.test(price))throw new Error('Price supports 0.1 USDT increments');
  const clientOrderId='0x'+Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
  return {symbol:'ETH-USDT',side,orderType:type,price,triggerPrice:'',quantity,reduceOnly,postOnly:false,isTriggerMarket:false,closePosition:false,clientOrderId};
}
export async function perpsRequest(params,auth={}){
  const response=await fetch('/api/perps',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({params,...auth})});
  const data=await response.json();
  if(!response.ok||data.status==='error')throw new Error(data.error?.message||data.error||`Market service error (${response.status})`);
  return data.response;
}
export async function connectWallet(provider){
  const browser=new BrowserProvider(provider);
  await browser.send('eth_requestAccounts',[]);
  const network=await browser.getNetwork();
  if(network.chainId!==1n)throw new Error('Switch your wallet to Ethereum Mainnet');
  const signer=await browser.getSigner();
  return {browser,signer,address:getAddress(await signer.getAddress())};
}
export async function signedRequest(signer,params,types,message,nonce){
  const signature=Signature.from(await signer.signTypedData(DOMAIN,types,message));
  return perpsRequest(params,{...(nonce?{nonce}:{}),expiresAfter:Number(message.expiresAfter),signature:{v:signature.v,r:signature.r,s:signature.s}});
}
export async function accountRequest(signer,subAccountId,action,filters={}){
  const expiresAfter=Date.now()+300000;
  return signedRequest(signer,{action,subAccountId,...filters},SUBACCOUNT_TYPES,{subAccountId,action,expiresAfter});
}
export async function setLeverage(signer,subAccountId,leverage){
  const nonce=nextNonce(),expiresAfter=Date.now()+300000;
  return signedRequest(signer,{action:'updateLeverage',subAccountId,symbol:'ETH-USDT',leverage:String(leverage)},LEVERAGE_TYPES,{subAccountId,symbol:'ETH-USDT',leverage:String(leverage),nonce,expiresAfter},nonce);
}
export async function placeOrder(signer,subAccountId,order){
  const nonce=nextNonce(),expiresAfter=Date.now()+300000,grouping='na';
  return signedRequest(signer,{action:'placeOrders',subAccountId,orders:[order],grouping,source:'direct'},ORDER_TYPES,{subAccountId,orders:[order],grouping,nonce,expiresAfter},nonce);
}
export async function cancelOrder(signer,subAccountId,orderId){
  const nonce=nextNonce(),expiresAfter=Date.now()+300000,orderIds=[String(orderId)];
  return signedRequest(signer,{action:'cancelOrders',subAccountId,orderIds},CANCEL_TYPES,{subAccountId,orderIds,nonce,expiresAfter},nonce);
}
export async function withdrawWeth(signer,subAccountId,destination,amount){
  const nonce=nextNonce(),expiresAfter=Date.now()+300000,symbol='WETH';
  const value=normalizeAmount(amount,'0.001');
  const to=getAddress(destination);
  return signedRequest(signer,{action:'withdrawCollateral',subAccountId,symbol,amount:value,destination:to},WITHDRAW_TYPES,{subAccountId,symbol,amount:value,destination:to,nonce,expiresAfter},nonce);
}
export async function walletBalances(wallet){
  const weth=new Contract(WETH,['function balanceOf(address) view returns (uint256)'],wallet.browser);
  const [eth,wrapped]=await Promise.all([wallet.browser.getBalance(wallet.address),weth.balanceOf(wallet.address)]);
  return {eth:formatEther(eth),weth:formatEther(wrapped)};
}
export async function wrapEth(wallet,amount){
  const value=parseEther(normalizeAmount(amount,'0.001'));
  const weth=new Contract(WETH,['function deposit() payable'],wallet.signer);
  const tx=await weth.deposit({value});await tx.wait();return tx.hash;
}
export async function depositWeth(wallet,amount,subAccountId=0){
  const value=parseEther(normalizeAmount(amount,'0.001'));
  const weth=new Contract(WETH,['function allowance(address,address) view returns (uint256)','function approve(address,uint256) returns (bool)'],wallet.signer);
  if(await weth.allowance(wallet.address,DEPOSIT)<value){const approval=await weth.approve(DEPOSIT,value);await approval.wait();}
  const contract=new Contract(DEPOSIT,['function deposit((address token,uint256 amount,address beneficiary,uint256 subAccountId,(((address token,uint256 amount) permitted,uint256 nonce,uint256 deadline) permit,bytes signature) permitDetails)[] deposits)'],wallet.signer);
  const tx=await contract.deposit([{token:WETH,amount:value,beneficiary:wallet.address,subAccountId,permitDetails:{permit:{permitted:{token:'0x0000000000000000000000000000000000000000',amount:0},nonce:0,deadline:0},signature:'0x'}}]);
  await tx.wait();return tx.hash;
}
export async function unwrapWeth(wallet,amount){
  const value=parseEther(normalizeAmount(amount,'0.001'));
  const weth=new Contract(WETH,['function withdraw(uint256 amount)'],wallet.signer);
  const tx=await weth.withdraw(value);await tx.wait();return tx.hash;
}
