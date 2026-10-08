import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {JsonRpcProvider, Wallet, parseEther, parseUnits, keccak256} from 'ethers';
import {checkReadiness} from '../src/readiness.js';
import {ADDRESSES, quoteSwap, buildSwap} from '../src/settlement.js';
import {EXCHANGE, verifyExchange, createOrder, orderHash} from '../src/orders.js';

const provider=new JsonRpcProvider(process.env.ETHEREUM_RPC_URL||'https://ethereum-rpc.publicnode.com');
try {
  const infrastructure=await checkReadiness(provider);
  assert.equal(infrastructure.chainId,1);
  const exchange=await verifyExchange(provider);
  // Ephemeral address only. No wallet connects to the provider or signs anything.
  const account=Wallet.createRandom().address;
  const order=createOrder({side:'sell',maker:account,quantity:'0.001',price:'2000',minutes:15,salt:1n});
  assert.equal(await exchange.getLimitOrderHash(order),orderHash(order));
  const quotes=[];
  for(const [direction,amountIn] of [['sell',parseEther('0.01')],['buy',parseUnits('10',6)]]) {
    const quote=await quoteSwap(provider,{direction,amountIn});
    const request=buildSwap({...quote,account,slippageBps:50});
    assert.equal(request.chainId,1);
    assert.equal(request.to,ADDRESSES.ROUTER);
    assert.ok(request.minimum>0n);
    quotes.push({direction,amountIn:String(amountIn),amountOut:String(quote.amountOut),minimumOutput:String(request.minimum),feeTier:quote.fee,block:quote.block});
  }
  const codeHashes={};
  for(const [name,address] of Object.entries({...ADDRESSES,EXCHANGE}))codeHashes[name]={address,keccak256:keccak256(await provider.getCode(address))};
  const evidence={checkedAt:new Date().toISOString(),...infrastructure,exchangeOwner:await exchange.owner(),signingDomainMatches:true,codeHashes,quotes,transactionsSubmitted:0,signaturesRequested:0,realFundsSpent:false};
  await writeFile(process.env.NEON_READINESS_OUTPUT||'validation/mainnet-readiness.json',JSON.stringify(evidence,null,2)+'\n');
  console.log(JSON.stringify(evidence,null,2));
} finally {provider.destroy();}
