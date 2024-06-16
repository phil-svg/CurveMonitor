import { getAbiBy, isAbiStored, fetchAbiFromEtherscan, storeAbiForAddressProvider } from './postgresTables/Abi.js';
import { NULL_ADDRESS } from './helperFunctions/Constants.js';
import { WEB3_HTTP_PROVIDER } from './web3Calls/generic.js';

// only requires the address of the Address-Provider.
// Collects addresses provided together with their ABIs.

interface AddressInfo {
  address: string;
  description: string;
}

export async function getProvidedAddress(): Promise<AddressInfo[] | null> {
  const TABLE_NAME = 'AbisRelatedToAddressProvider';
  const ADDRESS_ADDRESSPROVIDER = '0x0000000022D53366457F9d5E68Ec105046FC4383';
  const ABI = await getAbiBy(TABLE_NAME, { address: ADDRESS_ADDRESSPROVIDER });
  if (!ABI) {
    console.log(`Please provide the ABI for the Address Provider Contract`);
    return null;
  }

  const CONTRACT_ADDRESS_PROVIDER = new WEB3_HTTP_PROVIDER.eth.Contract(ABI, ADDRESS_ADDRESSPROVIDER);
  const MAX_ID = Number(await CONTRACT_ADDRESS_PROVIDER.methods.max_id().call());
  const ADDRESS_ARR: AddressInfo[] = [];

  const addressMapping: { [key: number]: AddressInfo } = {
    0: { address: '0x90E00ACe148ca3b23Ac1bC8C240C2a7Dd9c2d7f5', description: 'Main Registry' },
    1: { address: '0xe64608E223433E8a03a1DaaeFD8Cb638C14B552C', description: 'PoolInfo Getters' },
    2: { address: '0x99a58482BD75cbab83b27EC03CA68fF489b5788f', description: 'Exchanges' },
    3: { address: '0xB9fC157394Af804a3578134A6585C0dc9cc990d4', description: 'Metapool Factory' },
    4: { address: '0xA464e6DCda8AC41e03616F95f4BC98a13b8922Dc', description: 'Fee Distributor' },
    5: { address: '0x8F942C20D02bEfc377D41445793068908E2250D0', description: 'CryptoSwap Registry' },
    6: { address: '0xF18056Bbd320E96A48e3Fbf8bC061322531aac99', description: 'Cryptopool Factory' },
    7: { address: '0xF98B45FA17DE75FB1aD0e7aFD971b0ca00e379fC', description: 'Metaregistry' },
    8: { address: '0x4F8846Ae9380B90d2E71D5e3D042dff3E7ebb40d', description: 'crvUSD plain pools' },
    9: { address: NULL_ADDRESS, description: '' },
    10: { address: NULL_ADDRESS, description: '' },
    11: { address: '0x0c0e5f2fF0ff18a3be9b835635039256dC4B4963', description: 'Curve Tricrypto Factory' },
  };

  for (var i = 0; i <= MAX_ID; i++) {
    const address = addressMapping[i].address || (await CONTRACT_ADDRESS_PROVIDER.methods.get_address(i).call());
    if (address === NULL_ADDRESS) continue;

    const description =
      addressMapping[i].description || (await CONTRACT_ADDRESS_PROVIDER.methods.get_id_info(i).call());

    ADDRESS_ARR.push({
      address,
      description,
    });
  }

  const STABLESWAP_NG_FACTORY = '0x6A8cbed756804B16E05E741eDaBd5cB544AE21bf';
  if (!ADDRESS_ARR.some((e) => e.address === STABLESWAP_NG_FACTORY)) {
    ADDRESS_ARR.push({
      address: STABLESWAP_NG_FACTORY,
      description: 'Stableswap NG Factory',
    });
  }

  return ADDRESS_ARR;
}

async function storeAbisForProvidedAddresses(ADDRESS_ARR: string[]): Promise<void> {
  const TABLE_NAME = 'AbisRelatedToAddressProvider';
  for (const ADDRESS of ADDRESS_ARR) {
    if (!(await isAbiStored(TABLE_NAME, ADDRESS))) {
      await new Promise((resolve) => setTimeout(resolve, 200)); // ethersans' rate limit is 5 calls / second
      const ABI = await fetchAbiFromEtherscan(ADDRESS);
      if (!ABI) continue;
      await storeAbiForAddressProvider(ADDRESS, ABI);
    }
  }
}

export async function loadAddressProvider(): Promise<void> {
  const PROVIDED_ADDRESSES = await getProvidedAddress();
  if (PROVIDED_ADDRESSES) {
    const addresses = PROVIDED_ADDRESSES.map((info) => info.address);
    await storeAbisForProvidedAddresses(addresses);
    console.log('[✓] Address Provider Contracts synced successfully.');
  } else {
    console.log('Error syncing Address Provider Contracts.');
  }
}
