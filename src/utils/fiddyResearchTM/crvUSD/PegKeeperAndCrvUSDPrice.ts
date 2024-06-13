import fs from 'fs';
import { WEB3_HTTP_PROVIDER, web3Call } from '../../web3Calls/generic.js';
import { AbiItem } from 'web3-utils';

async function getCrvSpotPrice(blockNumber: number): Promise<number | null> {
  const tricrypto4Address = '0x4ebdf703948ddcea3b11f675b4d1fba9d2414a14';
  const ABI_GET_DY: AbiItem[] = [
    {
      stateMutability: 'view',
      type: 'function',
      name: 'get_dy',
      inputs: [
        { name: 'i', type: 'uint256' },
        { name: 'j', type: 'uint256' },
        { name: 'dx', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'uint256' }],
    },
  ];
  const tricrypto4 = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_GET_DY, tricrypto4Address);

  const PRICE = await web3Call(tricrypto4, 'get_dy', [2, 0, '1000000000000000000'], blockNumber);
  return Number(PRICE / 10 ** 18);
}

async function getCrvOraclePrice(blockNumber: number): Promise<number | null> {
  const CrvOracleAddress = '0xE0a4C53408f5ACf3246c83b9b8bD8d36D5ee38B8';
  const oracleAddress = CrvOracleAddress;
  const ABI_ORALCE: AbiItem[] = [
    { stateMutability: 'view', type: 'function', name: 'price', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  ];
  const ORACLE = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_ORALCE, oracleAddress);

  const PRICE = await web3Call(ORACLE, 'price', [], blockNumber);
  return Number(PRICE / 10 ** 18);
}

const getDebtBalance = async (address: string, blockNumber: number): Promise<number> => {
  const ABI: AbiItem[] = [
    { stateMutability: 'view', type: 'function', name: 'debt', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  ];
  const CONTRACT = new WEB3_HTTP_PROVIDER.eth.Contract(ABI, address);
  const balance = await web3Call(CONTRACT, 'debt', [], blockNumber);
  return balance / 1e18;
};

export async function getPriceOf_crvUSD(blockNumber: number): Promise<number | null> {
  const ADDRESS_crvUSD_PRICE_AGGREGATOR = '0xe5Afcf332a5457E8FafCD668BcE3dF953762Dfe7';
  const ABI_priceAggregator: AbiItem[] = [
    { stateMutability: 'view', type: 'function', name: 'price', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  ];
  const PRICE_AGGREGATOR = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_priceAggregator, ADDRESS_crvUSD_PRICE_AGGREGATOR);

  try {
    return (await PRICE_AGGREGATOR.methods.price().call(blockNumber)) / 1e18;
  } catch (error) {
    console.log(error);
    return null;
  }
}

async function getCrvUSDPriceFromUSDTPool(blockNumber: number) {
  const address = '0x390f3595bCa2Df7d23783dFd126427CCeb997BF4';
  const ABI_GET_DY: AbiItem[] = [
    {
      stateMutability: 'view',
      type: 'function',
      name: 'get_dy',
      inputs: [
        { name: 'i', type: 'int128' },
        { name: 'j', type: 'int128' },
        { name: 'dx', type: 'uint256' },
      ],
      outputs: [{ name: '', type: 'uint256' }],
    },
  ];
  const USDT_crvUSD = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_GET_DY, address);
  const price = await web3Call(USDT_crvUSD, 'get_dy', [0, 1, '1000000'], blockNumber);
  return 1 / (price / 1e18);
}

export async function getPegKeeperAndCrvUSDPriceData() {
  const startBlock = 20080075;
  const endBlock = 20080400 + 5 * 60 * 3;
  const address_PYUSD_crvUSD = '0x68e31e1eDD641B13cAEAb1Ac1BE661B19CC021ca';
  const address_USDC_crvUSD = '0x5B49b9adD1ecfe53E19cc2cFc8a33127cD6bA4C6';
  const address_USDT_crvUSD = '0xFF78468340EE322ed63C432BF74D817742b392Bf';

  const data = [];

  for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber++) {
    if (blockNumber % 10 !== 0) continue;
    console.log('progress: ', blockNumber, endBlock - blockNumber);
    const debt_PYUSD_crvUSD = await getDebtBalance(address_PYUSD_crvUSD, blockNumber);
    const debt_USDC_crvUSD = await getDebtBalance(address_USDC_crvUSD, blockNumber);
    const debt_USDT_crvUSD = await getDebtBalance(address_USDT_crvUSD, blockNumber);
    const CRV_spotPrice = await getCrvSpotPrice(blockNumber);
    const CRV_oraclePrice = await getCrvOraclePrice(blockNumber);
    const crvUSD_OraclePrice = await getPriceOf_crvUSD(blockNumber);
    const crvUSD_SpotPrice = await getCrvUSDPriceFromUSDTPool(blockNumber);
    data.push({
      blockNumber,
      debt_PYUSD_crvUSD,
      debt_USDC_crvUSD,
      debt_USDT_crvUSD,
      CRV_spotPrice,
      CRV_oraclePrice,
      crvUSD_OraclePrice,
      crvUSD_SpotPrice,
    });
  }
  // data.reverse();
  fs.writeFileSync('pegKeeperAndCrvUSDPriceData.json', JSON.stringify(data, null, 2));
  console.log('done');
}
