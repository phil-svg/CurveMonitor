import fetch from 'node-fetch';
export async function fetchChainNames() {
    const url = 'https://prices.curve.fi/v1/chains/';
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = (await response.json());
        return result.data.map((chain) => chain.name);
    }
    catch (error) {
        console.error('Error fetching chain names:', error);
        return [];
    }
}
export async function fetchDataForChain(chainName) {
    // console.log(`Fetching data for ${chainName}...`);
    const url = `https://prices.curve.fi/v1/chains/${chainName}?page=1&per_page=9999`;
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                Accept: 'application/json',
            },
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = (await response.json());
        return data;
    }
    catch (error) {
        console.error(`Error fetching data for ${chainName}:`, error);
        return null;
    }
}
export async function fetchCurvePoolData() {
    const chainNames = await fetchChainNames();
    for (const chainName of chainNames) {
        console.time(`fetchDataForChain-${chainName}`);
        await fetchDataForChain(chainName);
        console.timeEnd(`fetchDataForChain-${chainName}`);
        console.log('');
    }
}
//# sourceMappingURL=Pools.js.map