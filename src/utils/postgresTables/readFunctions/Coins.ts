import { Op } from "sequelize";
import { Coins } from "../../../models/Coins.js";
import { getLpTokenBy } from "./Pools.js";

export async function getCoinIdByAddress(address: string): Promise<number | null> {
  try {
    const coin = await Coins.findOne({
      where: {
        address: {
          [Op.iLike]: address.toLowerCase(),
        },
      },
    });

    return coin ? coin.id : null;
  } catch (error) {
    console.error("Error finding coin by address:", error);
    throw error;
  }
}

export async function findCoinDecimalsById(id: number): Promise<number | null> {
  try {
    const coin = await Coins.findByPk(id);

    return coin && coin.decimals !== undefined ? coin.decimals : null;
  } catch (error) {
    console.error("Error finding coin decimals by id:", error);
    throw error;
  }
}

export async function findCoinAddressById(id: number): Promise<string | null> {
  const coin = await Coins.findByPk(id);
  if (!coin) return null;

  return coin.address!;
}

export async function findCoinAddressesByIds(ids: number[]): Promise<string[]> {
  try {
    const coins = await Coins.findAll({
      where: {
        id: {
          [Op.in]: ids,
        },
      },
    });

    // Filter out any undefined or null addresses before returning
    return coins.map((coin) => coin.address).filter(Boolean) as string[];
  } catch (error) {
    console.error("Error finding coin addresses by ids:", error);
    throw error;
  }
}

export async function findCoinSymbolByAddress(address: string): Promise<string | null> {
  try {
    const coin = await Coins.findOne({
      where: {
        address: {
          [Op.iLike]: address.toLowerCase(),
        },
      },
    });

    return coin && coin.symbol !== undefined ? coin.symbol : null;
  } catch (error) {
    console.error("Error finding coin symbol by address:", error);
    throw error;
  }
}

export async function findCoinAddressBySymbol(symbol: string): Promise<string | null> {
  try {
    const coin = await Coins.findOne({
      where: {
        symbol: symbol,
      },
    });
    if (!coin) return null;

    return coin.address!;
  } catch (error) {
    console.error("Error finding coin address by symbol:", error);
    throw error;
  }
}

export async function findCoinSymbolById(id: number): Promise<string | null> {
  try {
    const coin = await Coins.findByPk(id);

    return coin && coin.symbol !== undefined ? coin.symbol : null;
  } catch (error) {
    console.error("Error finding coin symbol by id:", error);
    throw error;
  }
}

export const getLpTokenIdByPoolId = async (poolId: number): Promise<number | null> => {
  const lpTokenAddress = await getLpTokenBy({ id: poolId });
  if (!lpTokenAddress) {
    return null;
  }
  const lpTokenId = await getCoinIdByAddress(lpTokenAddress);
  return lpTokenId;
};
