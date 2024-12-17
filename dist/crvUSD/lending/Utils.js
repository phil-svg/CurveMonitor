import fetch from 'node-fetch';
export async function fetchLendingMarketsForChain(chain) {
    const url = `https://prices.curve.fi/v1/lending/markets/${chain}?fetch_on_chain=false&page=1&per_page=200`;
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                accept: 'application/json',
            },
        });
        if (!response.ok) {
            throw new Error(`Failed to fetch data: ${response.statusText}`);
        }
        const data = (await response.json());
        return data;
    }
    catch (error) {
        console.error('Error fetching market data:', error);
        throw error;
    }
}
//# sourceMappingURL=Utils.js.map