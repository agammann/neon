import {test} from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import {BrowserProvider,ContractFactory,parseEther} from 'ethers';
import {compileNativeMarket} from '../compile.mjs';

const compiled=await compileNativeMarket();
const usd8=value=>BigInt(value)*100000000n;

async function fixture(chainId=31337){
  const chain=ganache.provider({chain:{chainId},wallet:{totalAccounts:3,defaultBalance:100},logging:{quiet:true}});
  const provider=new BrowserProvider(chain);
  const [alice,bob,carol]=await Promise.all([provider.getSigner(0),provider.getSigner(1),provider.getSigner(2)]);
  const oracle=await new ContractFactory(compiled.oracle.abi,compiled.oracle.evm.bytecode.object,alice).deploy(usd8(2000));
  await oracle.waitForDeployment();
  return {chain,provider,alice,bob,carol,oracle,marketFactory:new ContractFactory(compiled.market.abi,compiled.market.evm.bytecode.object,alice)};
}

async function deployed(){
  const f=await fixture();
  const market=await f.marketFactory.deploy(await f.oracle.getAddress());
  await market.waitForDeployment();
  return {...f,market};
}

async function openPair(f,{makerIsLong=true,leverage=2,margin='1'}={}){
  const amount=parseEther(margin);
  await(await f.market.connect(f.alice).deposit({value:amount})).wait();
  await(await f.market.connect(f.bob).deposit({value:amount})).wait();
  const block=await f.provider.getBlock('latest');
  const offerId=await f.market.nextOfferId();
  await(await f.market.connect(f.alice).postOffer(makerIsLong,amount,leverage,block.timestamp+3600,100)).wait();
  const positionId=await f.market.nextPositionId();
  await(await f.market.connect(f.bob).matchOffer(offerId,usd8(1999),usd8(2001))).wait();
  return {amount,offerId,positionId};
}

test('Alice and Bob match native ETH, settle opposite PnL, and withdraw all collateral',async()=>{
  const f=await deployed();
  try{
    const {amount,positionId}=await openPair(f);
    assert.equal(await f.market.availableWei(await f.alice.getAddress()),0n);
    assert.equal(await f.market.availableWei(await f.bob.getAddress()),0n);
    assert.equal((await f.market.positions(positionId)).longTrader,await f.alice.getAddress());
    await assert.rejects(f.market.connect(f.carol).closePosition(positionId));
    await(await f.oracle.setPrice(usd8(2200),{gasLimit:100000})).wait();
    await(await f.market.connect(f.alice).closePosition(positionId)).wait();
    const gain=amount*2n*usd8(200)/usd8(2200);
    assert.equal(await f.market.availableWei(await f.alice.getAddress()),amount+gain);
    assert.equal(await f.market.availableWei(await f.bob.getAddress()),amount-gain);
    assert.equal(await f.market.totalLiabilityWei(),amount*2n);
    assert.equal(await f.provider.getBalance(await f.market.getAddress()),amount*2n);
    await(await f.market.connect(f.alice).withdraw(amount+gain)).wait();
    await(await f.market.connect(f.bob).withdraw(amount-gain)).wait();
    assert.equal(await f.market.totalLiabilityWei(),0n);
    assert.equal(BigInt(await f.chain.request({method:'eth_getBalance',params:[await f.market.getAddress(),'latest']})),0n);
  }finally{await f.chain.disconnect();}
});

test('price deviation, locked margin, offer cancellation, and liquidation enforce bounds',async()=>{
  const f=await deployed();
  try{
    const amount=parseEther('1');
    await(await f.market.connect(f.alice).deposit({value:amount})).wait();
    await(await f.market.connect(f.bob).deposit({value:amount})).wait();
    const block=await f.provider.getBlock('latest');
    await(await f.market.connect(f.alice).postOffer(false,amount,5,block.timestamp+3600,100)).wait();
    await assert.rejects(f.market.connect(f.alice).withdraw(amount));
    await assert.rejects(f.market.connect(f.carol).cancelOffer(1));
    await(await f.oracle.setPrice(usd8(2050),{gasLimit:100000})).wait();
    await assert.rejects(f.market.connect(f.bob).matchOffer(1,usd8(1900),usd8(2100)));
    await(await f.market.connect(f.alice).cancelOffer(1)).wait();
    assert.equal(await f.market.availableWei(await f.alice.getAddress()),amount);
    const {positionId}=await openPairWithExisting(f);
    await assert.rejects(f.market.connect(f.carol).liquidate(positionId));
    await(await f.oracle.setPrice(usd8(1750),{gasLimit:100000})).wait();
    await f.market.connect(f.carol).liquidate.staticCall(positionId);
    await(await f.market.connect(f.carol).liquidate(positionId,{gasLimit:150000})).wait();
    const longPayout=amount-amount*5n*usd8(300)/usd8(1750);
    assert.equal(await f.market.availableWei(await f.bob.getAddress()),longPayout);
    assert.equal(await f.market.availableWei(await f.alice.getAddress()),2n*amount-longPayout);
  }finally{await f.chain.disconnect();}
});

async function openPairWithExisting(f){
  const block=await f.provider.getBlock('latest');
  const offerId=await f.market.nextOfferId();
  await(await f.market.connect(f.alice).postOffer(false,parseEther('1'),5,block.timestamp+3600,100)).wait();
  const positionId=await f.market.nextPositionId();
  await(await f.market.connect(f.bob).matchOffer(offerId,usd8(2049),usd8(2051))).wait();
  return {positionId};
}

test('stale oracle blocks priced closes but permits neutral ETH refund after one day',async()=>{
  const f=await deployed();
  try{
    const {amount,positionId}=await openPair(f);
    await f.chain.request({method:'evm_increaseTime',params:[86401]});
    await f.chain.request({method:'evm_mine',params:[]});
    await assert.rejects(f.market.connect(f.alice).closePosition(positionId));
    await(await f.market.connect(f.carol).refundStalePosition(positionId)).wait();
    assert.equal(await f.market.availableWei(await f.alice.getAddress()),amount);
    assert.equal(await f.market.availableWei(await f.bob.getAddress()),amount);
  }finally{await f.chain.disconnect();}
});

test('a reverting oracle cannot permanently trap either trader’s ETH',async()=>{
  const f=await deployed();
  try{
    const {amount,positionId}=await openPair(f);
    await(await f.oracle.setBroken(true)).wait();
    await assert.rejects(f.market.connect(f.carol).refundStalePosition(positionId));
    await f.chain.request({method:'evm_increaseTime',params:[86401]});
    await f.chain.request({method:'evm_mine',params:[]});
    await f.market.connect(f.carol).refundStalePosition.staticCall(positionId);
    await(await f.market.connect(f.carol).refundStalePosition(positionId,{gasLimit:150000})).wait();
    assert.equal(await f.market.availableWei(await f.alice.getAddress()),amount);
    assert.equal(await f.market.availableWei(await f.bob.getAddress()),amount);
    assert.equal(await f.market.totalLiabilityWei(),2n*amount);
  }finally{await f.chain.disconnect();}
});

test('extreme oracle moves cannot pay out more ETH than both traders deposited',async()=>{
  for(const exit of [100,100000]){
    const f=await deployed();
    try{
      const {amount,positionId}=await openPair(f,{leverage:5});
      await(await f.oracle.setPrice(usd8(exit),{gasLimit:100000})).wait();
      await(await f.market.connect(f.alice).closePosition(positionId,{gasLimit:150000})).wait();
      const alice=await f.market.availableWei(await f.alice.getAddress());
      const bob=await f.market.availableWei(await f.bob.getAddress());
      assert.equal(alice+bob,2n*amount);
      assert.ok(alice>=0n&&alice<=2n*amount);
      assert.ok(bob>=0n&&bob<=2n*amount);
      assert.equal(await f.market.totalLiabilityWei(),2n*amount);
    }finally{await f.chain.disconnect();}
  }
});

test('prototype bytecode refuses Ethereum Mainnet chain ID',async()=>{
  const f=await fixture(1);
  try{await assert.rejects(f.marketFactory.deploy(await f.oracle.getAddress()));}finally{await f.chain.disconnect();}
});
