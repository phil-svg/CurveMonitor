import fs from 'fs';
import { WEB3_HTTP_PROVIDER, web3Call } from '../../web3Calls/generic.js';
async function getCrvSpotPrice(blockNumber) {
    const tricrypto4Address = '0x4ebdf703948ddcea3b11f675b4d1fba9d2414a14';
    const ABI_GET_DY = [
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
async function getCrvOraclePrice(blockNumber) {
    const CrvOracleAddress = '0xE0a4C53408f5ACf3246c83b9b8bD8d36D5ee38B8';
    const oracleAddress = CrvOracleAddress;
    const ABI_ORALCE = [
        { stateMutability: 'view', type: 'function', name: 'price', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
    ];
    const ORACLE = new WEB3_HTTP_PROVIDER.eth.Contract(ABI_ORALCE, oracleAddress);
    const PRICE = await web3Call(ORACLE, 'price', [], blockNumber);
    return Number(PRICE / 10 ** 18);
}
export async function compareOracleAgainstSpot() {
    const startBlock = 20061213;
    const endBlock = 20061717;
    const priceComparisonResults = [];
    for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber++) {
        if (blockNumber % 5 !== 0)
            continue;
        console.log('progress: ', blockNumber, endBlock - blockNumber);
        const spotPrice = await getCrvSpotPrice(blockNumber);
        const oraclePrice = await getCrvOraclePrice(blockNumber);
        priceComparisonResults.push({
            blockNumber,
            spotPrice,
            oraclePrice,
        });
    }
    fs.writeFileSync('priceComparisonResults.json', JSON.stringify(priceComparisonResults, null, 2));
    console.log('done');
}
//# sourceMappingURL=OralceChart.js.map