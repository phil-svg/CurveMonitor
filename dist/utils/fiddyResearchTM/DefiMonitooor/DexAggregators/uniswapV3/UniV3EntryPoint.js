import { getUniswapV3RequiredSwapAmountForTargetPriceWithAddedValue } from './Math.js';
export async function uniswapV3EntryPoint() {
    const address_uniswap_V3_USDC_USDT = '0x3416cf6c708da44db2624d63ea0aaef7113527c6';
    const targetPrice = 0.999576918469761;
    let blockNumberOfSwap = 19617393;
    const swapAmount = await getUniswapV3RequiredSwapAmountForTargetPriceWithAddedValue(address_uniswap_V3_USDC_USDT, targetPrice, blockNumberOfSwap - 1);
    console.log('swapAmount:', swapAmount);
}
/*
needs 2 cases solved:
Case1: give pool token0, get from pool token1.
Question: How many Token1 will I get for n given Token0 ?
Case2: give pool token1, get from pool token0.
Question: How many Token0 will I get for n given Token1 ?

Needs 2 functions.
*/
/*
this is a simple solved case. Archived.
block: 19617393
https://etherscan.io/tx/0x7e998d0a34d02b2c4cfa31be83fd7c96a97c77f30e9dbd330d6fcb583ea82b16
sold 103,832.561129 USDT, received 103,866.331413 USDC
103,832.561129 / 103,866.331413 = 0.99967486784;

deltaTokenOther: 103832.76972387958

Hypothetical Fee: 10.3866331413. That makes the real price:  103,832.561129 / (103,866.331413 + 10.3866331413) = 0.99957491035

1 block before: sqrtPriceCurrent 7.921124082884794e+28 => 0.9995728822227272 USDC / USDT
right at swap:  sqrtPriceCurrent 7.921140075506181e+28 => 0.999576918469761 USDC / USDT
1 block later:  sqrtPriceCurrent 7.921140075506181e+28 => 0.999576918469761 USDC / USDT

swapAmount: { deltaTokens: 103866.33141156498, deltaTokenOther: 103832.56008762041 }
*/
/*

export async function uniswapV3EntryPoint() {
  const address_uniswap_V3_USDC_USDT = '0x3416cf6c708da44db2624d63ea0aaef7113527c6';

  const token0 = 'USDC';
  const token0decimals = 6;

  const token1 = 'USDT';
  const token1decimals = 6;

  const targetPrice = 0.999576918469761;

  let blockNumberOfSwap = 19617393;

  const poolFee = 0.0001; // 0.01%

  const swapAmount = await getUniswapV3RequiredSwapAmountForTargetPrice(
    address_uniswap_V3_USDC_USDT,
    token0,
    token1,
    token0decimals,
    token1decimals,
    targetPrice,
    blockNumberOfSwap - 1
  );
  console.log('swapAmount', swapAmount);
}

*/
/*

sold USDC case:
0xad740cd19e5b20a7e7584c2607d997f6261913d06f95985a1cbd62d2412b854c
1,344,268.725373 USDC -> 1,343,592.537744 USDT
Block: 19617232
Price Block -1 = sqrtPriceCurrent 7.921324446009655e+28 = 0.999623450823118
Price Block 0  = sqrtPriceCurrent 7.921115510093436e+28 = 0.999570718609321
Price Block +1 = sqrtPriceCurrent 7.921115510093436e+28 = 0.999570718609321

1,343,592.537744/0.999570718609321 = 1,344,169.56472
(1,343,592.537744*1.0001)/0.999570718609321 = 1,344,303.98168
1,344,268.725373*0.999570718609321 = 1,343,691.65583

swapAmount: { deltaTokens: 1343592.537744608, deltaTokenOther: 1344268.711928427 } (result off by 1.35 cents on 1.3m$)

swapAmount: 1,343,592.537744608 = should have bought for 1,343,592.537744 USDT to reach target price

in the first case: swapAmount: 103866.33141156498 = should have bought 103,866.331411 USDC to reach target price
*/
//# sourceMappingURL=UniV3EntryPoint.js.map