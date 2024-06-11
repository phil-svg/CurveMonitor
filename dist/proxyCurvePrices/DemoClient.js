import fetch from 'node-fetch';
const baseUrl = 'http://localhost:8443';
// const baseUrl = 'https://api.curvemonitor.com';
async function fetchChainData(chainName) {
    const url = `${baseUrl}/proxyCurvePricesAPI/chains/${chainName}`;
    console.log('url: ', url);
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
        const data = await response.json();
        console.log(`Data received for ${chainName}:`, data);
        return data;
    }
    catch (error) {
        console.error(`Error fetching data for ${chainName}:`, error);
        return null;
    }
}
export async function runDemoClientForProxyABI() {
    const chainName = 'ethereum';
    const chainData = await fetchChainData(chainName);
    console.log(chainData);
}
//# sourceMappingURL=DemoClient.js.map