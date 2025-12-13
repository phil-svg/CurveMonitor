import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Sequelize } from 'sequelize-typescript';
import { AbiModels } from '../models/Abi.js';
import { Pool } from '../models/Pools.js';
import { Coins } from '../models/Coins.js';
import { PoolParamsEvents } from '../models/PoolParamsEvents.js';
import { InitialParams } from '../models/InitialParams.js';
import { PoolCountFromProvider } from '../models/PoolCountFromProvider.js';
import { RawTxLogs } from '../models/RawTxLogs.js';
import { Transactions } from '../models/Transactions.js';
import { Blocks } from '../models/Blocks.js';
import { TransactionCoins } from '../models/TransactionCoins.js';
import { Labels } from '../models/Labels.js';
import { Sandwiches } from '../models/Sandwiches.js';
import { BlockScanningData } from '../models/BlockScanningData.js';
import { CurrentBlock } from '../models/CurrentBlock.js';
import { TransactionDetails } from '../models/TransactionDetails.js';
import { AddressesCalledCounts } from '../models/AddressesCalledCount.js';
import { Contracts } from '../models/Contracts.js';
import { ProxyCheck } from '../models/ProxyCheck.js';
import { UnverifiedContracts } from '../models/UnverifiedContracts.js';
import { PriceMap } from '../models/PriceMap.js';
import { FirstPriceTimestamp } from '../models/FirstTokenPrices.js';
import { AtomicArbs } from '../models/AtomicArbs.js';
import { TokenTransfers } from '../models/CleanedTransfers.js';
import { IsCexDexArb } from '../models/IsCexDexArb.js';
import { CexDexArbs } from '../models/CexDexArbs.js';
import { IsSandwich } from '../models/IsSandwich.js';
import { Bytecode } from '../models/PoolsByteCode.js';
import { RiskMintMarketInfo } from '../models/RiskMintMarkets.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, '..', '..', '.env') });
export const sequelize = new Sequelize({
    database: process.env.DATABASE_NAME,
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT) || 5432,
    dialect: 'postgres',
    pool: {
        max: 20,
        min: 2,
        acquire: 30000,
        idle: 10000,
    },
    models: [
        ...AbiModels,
        Pool,
        PoolCountFromProvider,
        RawTxLogs,
        BlockScanningData,
        Transactions,
        Labels,
        Sandwiches,
        Coins,
        PoolParamsEvents,
        InitialParams,
        Blocks,
        TransactionCoins,
        CurrentBlock,
        TransactionDetails,
        AddressesCalledCounts,
        Contracts,
        ProxyCheck,
        UnverifiedContracts,
        PriceMap,
        FirstPriceTimestamp,
        AtomicArbs,
        TokenTransfers,
        IsCexDexArb,
        CexDexArbs,
        IsSandwich,
        Bytecode,
        RiskMintMarketInfo,
    ],
    logging: false,
});
export { sequelize as db };
//# sourceMappingURL=Database.js.map