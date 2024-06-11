import fetch from 'node-fetch';

const baseUrl = 'http://localhost:3000';
// const baseUrl = 'https://api.curvemonitor.com';

async function fetchChainData(chainName: string) {
  const url = `${baseUrl}/proxyCurvePricesAPI/chains/${chainName}`;

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
  } catch (error) {
    console.error(`Error fetching data for ${chainName}:`, error);
    return null;
  }
}

// Usage: Fetch data for "ethereum"
fetchChainData('ethereum').then((data) => {
  if (data) {
    console.log('Successfully fetched chain data:', data);
  }
});

export async function runDemoClientForProxyABI() {
  const chainName = 'base';
  const chainData = await fetchChainData(chainName);
  console.log(chainData);
}
