import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {JsonRpcProvider,keccak256} from 'ethers';
import {WETH,DEPOSIT} from '../src/synthetix-client.js';

const rpc=new JsonRpcProvider(process.env.ETHEREUM_RPC_URL||'https://ethereum-rpc.publicnode.com');
const info=async (action,extra={})=>{
  const response=await fetch('https://papi.synthetix.io/v1/info',{method:'POST',headers:{'content-type':'application/json','user-agent':'Neon/2.0 (mainnet readiness check)'},body:JSON.stringify({params:{action,...extra}}),signal:AbortSignal.timeout(12000)});
  const json=await response.json();
  assert.equal(response.status,200,`${action} returned HTTP ${response.status}`);
  assert.equal(json.status,'ok',`${action} failed`);
  return json.response;
};
try{
  const [network,wethCode,depositCode,markets,prices,collaterals,tradingAccess]=await Promise.all([rpc.getNetwork(),rpc.getCode(WETH),rpc.getCode(DEPOSIT),info('getMarkets'),info('getMarketPrices'),info('getCollaterals'),info('getIsWhitelisted',{walletAddress:'0x1111111111111111111111111111111111111111'})]);
  assert.equal(network.chainId,1n);
  assert.notEqual(wethCode,'0x');assert.notEqual(depositCode,'0x');
  const eth=markets.find(m=>m.symbol==='ETH-USDT');
  assert.ok(eth?.isOpen,'ETH-USDT must be open');
  assert.ok(Number(prices['ETH-USDT']?.markPrice)>0,'Mark price must be positive');
  assert.ok(Math.abs(Date.now()-Number(prices['ETH-USDT']?.timestamp))<60000,'Market price must be fresh');
  assert.ok(collaterals.some(c=>c.collateral==='WETH'),'WETH collateral must be enabled');
  assert.equal(typeof tradingAccess,'boolean','Trading access endpoint must return a boolean');
  const evidence={checkedAt:new Date().toISOString(),chainId:1,venue:'Synthetix',market:'ETH-USDT',marketOpen:eth.isOpen,closeOnly:eth.isCloseOnly,maxLeverage:eth.maintenanceMarginTiers?.[0]?.maxLeverage,minOrderSize:eth.minOrderSize,wethCollateral:true,tradingAccessEndpointAvailable:true,contractCodeHashes:{weth:keccak256(wethCode),deposit:keccak256(depositCode)},transactionsSubmitted:0,realFundsSpent:false};
  await writeFile('validation/perps-mainnet-readiness.json',JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence,null,2));
}finally{rpc.destroy();}
