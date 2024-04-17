import { getUniswapV3Contract } from './ContractGetter.js';

function x_in_range(liq: number, pa: number, pb: number): number {
  if (pa > pb) {
    let temp = pb;
    pb = pa;
    pa = temp;
  }
  let x_in_range = (liq * 2 ** 96 * (pb - pa)) / pa / pb;
  return x_in_range;
}

function y_in_range(liq: number, pa: number, pb: number): number {
  if (pa > pb) {
    let temp = pb;
    pb = pa;
    pa = temp;
  }

  let y_in_range = (liq * (pb - pa)) / 2 ** 96;
  return y_in_range;
}

// poolAddress: uniswap v3 pool
// targetPrice in 0.99957691 notation
// blockNumber: optional, if not given: uses latest block
export async function getUniswapV3RequiredSwapAmountForTargetPriceWithAddedValue(
  poolAddress: string,
  targetPrice: number,
  blockNumber?: number
) {
  let block = blockNumber ? blockNumber : { block: 'latest' };

  const V3_POOL = getUniswapV3Contract(poolAddress); //  new WEB3_HTTP_PROVIDER.eth.Contract(abiV3, contractAddress);

  // Pool Config are Hardcoded instead. When testing many differnt Uniswap v3 Pools, this code-block can get used instead.
  // const poolFee = Number(await V3_POOL.methods.fee().call(block)) / 1e6;
  // const token0Address = await V3_POOL.methods.token0().call(block);
  // const token1Address = await V3_POOL.methods.token1().call(block);
  // const token0decimals = await fetchDecimalsFromChain(token0Address);
  // const token1decimals = await fetchDecimalsFromChain(token1Address);
  // const token0Name = await fetchSymbolFromChain(token0Address);
  // const token1Name = await fetchSymbolFromChain(token1Address);

  const poolFee = 0.0001; // 0.001%
  const token0decimals = 6;
  const token1decimals = 6;
  // const token0Name = 'USDC';
  // const token1Name = 'USDT';

  console.log('Block', block);
  console.log('Pool:', poolAddress);
  // console.log('Token0:', token0Name);
  // console.log('Token1:', token1Name);
  console.log('Target Price:', targetPrice);

  var slot0 = await V3_POOL.methods.slot0().call(block);

  var sPriceCurrent = Number(slot0.sqrtPriceX96); // sqrt of the current price
  var sPriceTarget = (Math.sqrt(targetPrice) * 2 ** 96) / 10 ** ((token0decimals - token1decimals) / 2);
  var liquidity = Number(await V3_POOL.methods.liquidity().call(block));
  const tickSpacing = Number(await V3_POOL.methods.tickSpacing().call(block));
  var tickLower = Number((slot0.tick / tickSpacing).toFixed(0)) * tickSpacing;
  var tickUpper = tickLower + tickSpacing;
  var sPriceLower = Math.sqrt(1.0001 ** tickLower) * 2 ** 96;
  var sPriceUpper = Math.sqrt(1.0001 ** tickUpper) * 2 ** 96;
  let deltaTokens = 0;
  let deltaTokenOther = 0;

  console.log(
    'sPriceCurrent',
    sPriceCurrent,
    '=',
    (10 ** (token0decimals - token1decimals) * sPriceCurrent ** 2) / 2 ** 192 // this prints the price used in the examples
  );

  let emptyTicksCounter = 0; // to have a stop condition, otherwise might run forever

  // targetPrice higher than current price, we move up the ticks. We depleat all liquidity tick by tick until we reach the targetPrice
  if (sPriceTarget > sPriceCurrent) {
    while (sPriceTarget > sPriceCurrent) {
      if (sPriceTarget > sPriceUpper) {
        // being here means we have to use all liquity in the current tick
        deltaTokens += x_in_range(liquidity, sPriceCurrent, sPriceUpper);
        deltaTokenOther += y_in_range(liquidity, sPriceCurrent, sPriceUpper);
        let nextTickRange = await V3_POOL.methods.ticks(tickUpper).call(block);
        if (Number(nextTickRange.liquidityNet) === 0) emptyTicksCounter++;
        liquidity += Number(nextTickRange.liquidityNet);
        sPriceCurrent = sPriceUpper;
        tickLower = tickUpper;
        tickUpper += tickSpacing;
        sPriceLower = sPriceUpper;
        sPriceUpper = Math.sqrt(1.0001 ** tickUpper) * 2 ** 96;
      } else {
        // being here means we reached the final tick, and use a portion of the available liquidity
        deltaTokens += x_in_range(liquidity, sPriceCurrent, sPriceTarget);
        deltaTokenOther += y_in_range(liquidity, sPriceCurrent, sPriceTarget);
        sPriceCurrent = sPriceTarget;
      }
      if (emptyTicksCounter === 3) return "can't reach price, not enough liquidity";
    }
    // targetPrice lower than current price, we move down the ticks. We depleat all liquidity tick by tick until we reach the targetPrice
  } else if (sPriceTarget < sPriceCurrent) {
    let currentTickRange = null;
    while (sPriceTarget < sPriceCurrent) {
      if (sPriceTarget < sPriceLower) {
        // being here means we have to use all liquity in the current tick
        deltaTokens += y_in_range(liquidity, sPriceCurrent, sPriceLower);
        deltaTokenOther += x_in_range(liquidity, sPriceCurrent, sPriceLower);
        if (!currentTickRange) currentTickRange = await V3_POOL.methods.ticks(tickLower).call(block);
        if (Number(currentTickRange.liquidityNet) === 0) emptyTicksCounter++;
        liquidity -= Number(currentTickRange.liquidityNet);
        sPriceCurrent = sPriceLower;
        tickUpper = tickLower;
        tickLower -= tickSpacing;
        sPriceUpper = sPriceLower;
        sPriceLower = Math.sqrt(1.0001 ** tickLower) * 2 ** 96;
        currentTickRange = await V3_POOL.methods.ticks(tickLower).call(block);
      } else {
        // being here means we reached the final tick, and use a portion of the available liquidity
        deltaTokens += y_in_range(liquidity, sPriceCurrent, sPriceTarget);
        deltaTokenOther += x_in_range(liquidity, sPriceCurrent, sPriceTarget);

        sPriceCurrent = sPriceTarget;
      }
      if (emptyTicksCounter === 3) return "can't reach price, not enough liquidity";
    }
  }
  deltaTokens = Number(deltaTokens / 10 ** token0decimals);
  deltaTokenOther = Number(deltaTokenOther / 10 ** token1decimals);
  deltaTokenOther = deltaTokenOther * (1 + poolFee);
  console.log('\nfinal results:');
  console.log(
    'sPriceCurrent',
    sPriceCurrent,
    '=',
    (10 ** (token0decimals - token1decimals) * sPriceCurrent ** 2) / 2 ** 192
  );
  return { deltaTokens, deltaTokenOther };
}

// async function main() {
//   // Uniswap v3 USDC-USDT
//   const address_uniswap_V3_USDC_USDT = '0x3416cf6c708da44db2624d63ea0aaef7113527c6';

//   const targetPrice = 0.999576918469761;
//   let blockNumberOfSwap = 19617393;

//   const result = await getUniswapV3RequiredSwapAmountForTargetPriceWithAddedValue(
//     address_uniswap_V3_USDC_USDT,
//     targetPrice,
//     blockNumberOfSwap - 1
//   );
//   console.log('result:', result);
// }

// await main();

/*
To run the Examples, I used a targetPrice. The targetPrice was taken from the price at the next block.
The Line in the Code was market with <this prints the price used in the examples>

Example 1 (swap USDT into USDC):
Block: 19617393
https://etherscan.io/tx/0x7e998d0a34d02b2c4cfa31be83fd7c96a97c77f30e9dbd330d6fcb583ea82b16
sold 103,832.561129 USDT, received 103,866.331413 USDC
TargetPrice: 0.999576918469761
function returned: { deltaTokens: 103866.33141156498, deltaTokenOther: 103832.56008762041 }

Example 2 (swap USDC into USDT):
Block: 19617232
https://etherscan.io/tx/0xad740cd19e5b20a7e7584c2607d997f6261913d06f95985a1cbd62d2412b854c
sold 1,344,268.725373 USDC, received 1,343,592.537744 USDT
TargetPrice: 0.999570718609321 
function returned: { deltaTokens: 1343592.537744608, deltaTokenOther: 1344268.711928427 }

*/
