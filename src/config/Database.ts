import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { Sequelize } from "sequelize-typescript";
import { AbiModels } from "../models/Abi.js";
import { Pool } from "../models/Pools.js";
import { Coins } from "../models/Coins.js";
import { PoolParamsEvents } from "../models/PoolParamsEvents.js";
import { InitialParams } from "../models/InitialParams.js";
import { PoolCountFromProvider } from "../models/PoolCountFromProvider.js";
import { RawTxLogs } from "../models/RawTxLogs.js";
import { Transactions } from "../models/Transactions.js";
import { Blocks } from "../models/Blocks.js";
import { TransactionCoins } from "../models/TransactionCoins.js";
import { Labels } from "../models/Labels.js";
import { Sandwiches } from "../models/Sandwiches.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: resolve(__dirname, "..", "..", ".env") });

const sequelize = new Sequelize({
  database: process.env.DATABASE_NAME,
  username: process.env.DATABASE_USERNAME,
  password: process.env.DATABASE_PASSWORD,
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT) || 5432,
  dialect: "postgres",
  models: [...AbiModels, Pool, PoolCountFromProvider, RawTxLogs, Transactions, Labels, Sandwiches, Coins, PoolParamsEvents, InitialParams, Blocks, TransactionCoins],
  logging: false,
});

export { sequelize as db };
