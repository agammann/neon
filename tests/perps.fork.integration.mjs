import {test} from 'node:test';
import assert from 'node:assert/strict';
import ganache from 'ganache';
import {BrowserProvider,Contract,parseEther} from 'ethers';
import {WETH,DEPOSIT,wrapEth,unwrapWeth,depositWeth} from '../src/synthetix-client.js';

test('Ethereum fork: wrap ETH and deposit WETH to the published Synthetix contract', {timeout:180000},async()=>{
  const fork=ganache.provider({fork:{url:process.env.ETHEREUM_RPC_URL||'https://ethereum-rpc.publicnode.com'},chain:{chainId:1},wallet:{totalAccounts:1,defaultBalance:100},logging:{quiet:true}});
  try{
    const provider=new BrowserProvider(fork),signer=await provider.getSigner(),address=await signer.getAddress(),wallet={browser:provider,signer,address};
    assert.notEqual(await provider.getCode(WETH),'0x');
    assert.notEqual(await provider.getCode(DEPOSIT),'0x');
    const weth=new Contract(WETH,['function balanceOf(address) view returns (uint256)','function allowance(address,address) view returns (uint256)'],signer);
    const amount=parseEther('1');
    await wrapEth(wallet,'2');
    await unwrapWeth(wallet,'1');
    assert.equal(await weth.balanceOf(address),amount);
    const hash=await depositWeth(wallet,'1',0);
    const receipt=await provider.getTransactionReceipt(hash);
    assert.equal(receipt.status,1);
    assert.equal(await weth.balanceOf(address),0n);
    assert.equal(await weth.allowance(address,DEPOSIT),0n);
    console.log(JSON.stringify({forkBlock:await provider.getBlockNumber(),depositedWethWei:amount.toString(),realFundsSpent:false}));
  }finally{await fork.disconnect();}
});
