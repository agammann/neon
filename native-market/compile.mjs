import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import solc from 'solc';

const root=dirname(fileURLToPath(import.meta.url));
export async function compileNativeMarket(){
  const names=['NeonNativeMarket.sol','MockEthUsdOracle.sol'];
  const sources=Object.fromEntries(await Promise.all(names.map(async name=>[name,{content:await readFile(join(root,'contracts',name),'utf8')}])));
  const input={language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}};
  const output=JSON.parse(solc.compile(JSON.stringify(input)));
  const errors=(output.errors||[]).filter(item=>item.severity==='error');
  if(errors.length)throw new Error(errors.map(item=>item.formattedMessage).join('\n'));
  return {
    market:output.contracts['NeonNativeMarket.sol'].NeonNativeMarket,
    oracle:output.contracts['MockEthUsdOracle.sol'].MockEthUsdOracle,
    compiler:solc.version()
  };
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const result=await compileNativeMarket();
  await mkdir(join(root,'artifacts'),{recursive:true});
  for(const key of ['market','oracle'])await writeFile(join(root,'artifacts',`${key}.json`),JSON.stringify({compiler:result.compiler,abi:result[key].abi,bytecode:`0x${result[key].evm.bytecode.object}`},null,2)+'\n');
  console.log(`Compiled native ETH market and local oracle with ${result.compiler}`);
}
