type FeeBracket = {
  minVolume: number;
  minBnbBalance: number;
  fees: {
    maker: number;
    taker: number;
    makerWithBnbDiscount: number;
    takerWithBnbDiscount: number;
  };
};

// https://www.binance.com/en/fee/trading

const feeBrackets: FeeBracket[] = [
  { minVolume: 0, minBnbBalance: 0, fees: { maker: 0.001, taker: 0.001, makerWithBnbDiscount: 0.00075, takerWithBnbDiscount: 0.00075 } },
  { minVolume: 1000000, minBnbBalance: 25, fees: { maker: 0.0009, taker: 0.001, makerWithBnbDiscount: 0.000675, takerWithBnbDiscount: 0.00075 } },
  { minVolume: 5000000, minBnbBalance: 100, fees: { maker: 0.0008, taker: 0.001, makerWithBnbDiscount: 0.0006, takerWithBnbDiscount: 0.00075 } },
  { minVolume: 20000000, minBnbBalance: 250, fees: { maker: 0.00042, taker: 0.0006, makerWithBnbDiscount: 0.000315, takerWithBnbDiscount: 0.00045 } },
  { minVolume: 100000000, minBnbBalance: 500, fees: { maker: 0.00042, taker: 0.00054, makerWithBnbDiscount: 0.000315, takerWithBnbDiscount: 0.000405 } },
  { minVolume: 150000000, minBnbBalance: 1000, fees: { maker: 0.00036, taker: 0.00048, makerWithBnbDiscount: 0.00027, takerWithBnbDiscount: 0.00036 } },
  { minVolume: 400000000, minBnbBalance: 1750, fees: { maker: 0.0003, taker: 0.00042, makerWithBnbDiscount: 0.000225, takerWithBnbDiscount: 0.000315 } },
  { minVolume: 800000000, minBnbBalance: 3000, fees: { maker: 0.00024, taker: 0.00036, makerWithBnbDiscount: 0.00018, takerWithBnbDiscount: 0.00027 } },
  { minVolume: 2000000000, minBnbBalance: 4500, fees: { maker: 0.00018, taker: 0.0003, makerWithBnbDiscount: 0.000135, takerWithBnbDiscount: 0.000225 } },
  { minVolume: 4000000000, minBnbBalance: 5500, fees: { maker: 0.00012, taker: 0.00024, makerWithBnbDiscount: 0.00009, takerWithBnbDiscount: 0.00018 } },
];

/**
 * Calculates the trading fees based on the 30-day trading volume and BNB balance.
 *
 * @param volume - The 30-day trade volume in USD.
 * @param bnbBalance - The BNB balance.
 * @returns The applicable maker and taker fees.
 */
export function calculateBinanceFees(volume: number, bnbBalance: number): { makerFee: number; takerFee: number } {
  const applicableBracket = feeBrackets
    .slice()
    .reverse()
    .find((bracket) => volume >= bracket.minVolume && bnbBalance >= bracket.minBnbBalance);

  if (applicableBracket) {
    const { fees } = applicableBracket;
    return {
      makerFee: bnbBalance >= applicableBracket.minBnbBalance ? fees.makerWithBnbDiscount : fees.maker,
      takerFee: bnbBalance >= applicableBracket.minBnbBalance ? fees.takerWithBnbDiscount : fees.taker,
    };
  } else {
    // Default to the highest fees if no bracket is found
    return {
      makerFee: feeBrackets[0].fees.maker,
      takerFee: feeBrackets[0].fees.taker,
    };
  }
}
