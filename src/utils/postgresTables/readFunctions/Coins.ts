import { Op } from "sequelize";
import { Coins } from "../../../models/Coins.js";

export async function findCoinIdByAddress(address: string): Promise<number | null> {
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
