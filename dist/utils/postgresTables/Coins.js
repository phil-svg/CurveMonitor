import Web3 from "web3";
import { db } from "../../config/Database.js";
import { Coins } from "../../models/Coins.js";
import { Op, QueryTypes } from "sequelize";
if (!process.env.WEB3_WSS) {
    console.error("Error: WEB3_WSS environment variable is not defined.");
    process.exit(1);
}
const WEB3 = new Web3(new Web3.providers.WebsocketProvider(process.env.WEB3_WSS));
const ABI_SYMBOL = [
    {
        name: "symbol",
        outputs: [
            {
                type: "string",
                name: "",
            },
        ],
        inputs: [],
        stateMutability: "view",
        type: "function",
        gas: 6876,
    },
];
const ABI_DECIMALS = [
    {
        name: "decimals",
        outputs: [
            {
                type: "uint256",
                name: "",
            },
        ],
        inputs: [],
        stateMutability: "view",
        type: "function",
        gas: 1481,
    },
];
const ADDRESS_ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const ADDRESS_MKR = "0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2";
const ADDRESS_REUSD = "0x6b8734ad31D42F5c05A86594314837C416ADA984";
async function getAllUniqueCoinAddressesFromPoolTable() {
    try {
        const uniqueCoinAddresses = (await db.query('SELECT DISTINCT unnest("coins") FROM "pools"', {
            type: QueryTypes.SELECT,
            raw: true,
        })).map((result) => result.unnest);
        const uniqueLpTokenAddresses = (await db.query('SELECT DISTINCT "lp_token" FROM "pools" WHERE "lp_token" IS NOT NULL', {
            type: QueryTypes.SELECT,
            raw: true,
        })).map((result) => result.lp_token);
        const UNIQUE_ADDRESSES = Array.from(new Set([...uniqueCoinAddresses, ...uniqueLpTokenAddresses]));
        return UNIQUE_ADDRESSES;
    }
    catch (error) {
        console.error("Error fetching unique coin addresses:", error);
        return [];
    }
}
/** *********************** Adding init Entry *********************** */
async function isCoinAddressInTable(address) {
    try {
        const coin = await Coins.findOne({ where: { address } });
        return coin !== null;
    }
    catch (error) {
        console.error("Error checking coin address:", error);
        return false;
    }
}
async function updateAddresses() {
    const UNIQUE_ADDRESSES = await getAllUniqueCoinAddressesFromPoolTable();
    for (const UNIQUE_ADDRESSE of UNIQUE_ADDRESSES) {
        try {
            const exists = await isCoinAddressInTable(UNIQUE_ADDRESSE);
            if (exists)
                continue;
            await Coins.create({ address: UNIQUE_ADDRESSE }); // Fix here: Use 'address' instead of 'UNIQUE_ADDRESSE'
            console.log(`Coin address ${UNIQUE_ADDRESSE} added to table.`);
        }
        catch (error) {
            console.error("Error adding coin address to table:", error);
        }
    }
}
/** *********************** Adding Symbol *********************** */
async function fetchSymbolFromChain(coinAddress) {
    if (coinAddress === ADDRESS_ETH)
        return "ETH";
    if (coinAddress === ADDRESS_MKR)
        return "MKR";
    if (coinAddress === ADDRESS_REUSD)
        return "REUSD";
    const CONTRACT = new WEB3.eth.Contract(ABI_SYMBOL, coinAddress);
    return CONTRACT.methods.symbol().call();
}
async function updateSymbols() {
    try {
        const coinsWithoutSymbols = await Coins.findAll({
            where: {
                symbol: {
                    [Op.is]: null,
                },
            },
        });
        let i = 0;
        for (const coin of coinsWithoutSymbols) {
            i += 1;
            if (coin.symbol)
                continue; // Fix here: Continue if 'symbol' already exists
            if (!coin.address)
                continue;
            const SYMBOL = await fetchSymbolFromChain(coin.address);
            coin.symbol = SYMBOL;
            await coin.save();
        }
    }
    catch (error) {
        console.error("Error updating symbol:", error);
        throw error;
    }
}
/** *********************** Adding Decimals *********************** */
async function fetchDecimalsFromChain(coinAddress) {
    if (coinAddress === ADDRESS_ETH)
        return 18;
    const CONTRACT = new WEB3.eth.Contract(ABI_DECIMALS, coinAddress);
    return CONTRACT.methods.decimals().call();
}
async function updateDecimals() {
    try {
        const coinsWithoutDecimals = await Coins.findAll({
            where: {
                decimals: {
                    [Op.is]: null,
                },
            },
        });
        let i = 0;
        for (const coin of coinsWithoutDecimals) {
            i += 1;
            if (coin.decimals)
                continue; // Fix here: Continue if 'decimals' already exists
            if (!coin.address)
                continue;
            const DECIMALS = await fetchDecimalsFromChain(coin.address);
            coin.decimals = DECIMALS;
            await coin.save();
        }
    }
    catch (error) {
        console.error("Error updating symbol:", error);
        throw error;
    }
}
/** *********************** Final *********************** */
export async function updateCoinTable() {
    await updateAddresses();
    await updateSymbols();
    await updateDecimals();
    console.log(`[✓] Coins synced successfully.`);
}
//# sourceMappingURL=Coins.js.map