import { Op, Sequelize } from "sequelize";
import { Sandwiches } from "../../../models/Sandwiches.js";
import { Transactions } from "../../../models/Transactions.js";
import { getIdByAddress } from "./Pools.js";

export async function readSandwichesInBatches(batchSize: number = 100): Promise<{ id: number; loss_transactions: any }[][]> {
  let offset = 0;
  const batches: { id: number; loss_transactions: any }[][] = [];

  while (true) {
    const sandwiches = await Sandwiches.findAll({
      where: {
        extracted_from_curve: true,
        source_of_loss_contract_address: null,
      },
      limit: batchSize,
      offset: offset,
    });

    if (sandwiches.length === 0) {
      break;
    }

    const transformedSandwiches = sandwiches.map((sandwich) => ({
      id: sandwich.id,
      loss_transactions: sandwich.loss_transactions,
    }));

    batches.push(transformedSandwiches);
    offset += batchSize;
  }

  return batches;
}

export async function readSandwichesInBatchesForBlock(blockNumber: number, batchSize: number = 100): Promise<{ id: number; loss_transactions: any }[][]> {
  let offset = 0;
  const batches: { id: number; loss_transactions: any }[][] = [];

  while (true) {
    const sandwiches = await Sandwiches.findAll({
      where: {
        extracted_from_curve: true,
        source_of_loss_contract_address: null,
      },
      include: [
        {
          model: Transactions,
          as: "frontrunTransaction",
          where: { block_number: blockNumber },
          required: true,
        },
        {
          model: Transactions,
          as: "backrunTransaction",
          where: { block_number: blockNumber },
          required: true,
        },
      ],
      limit: batchSize,
      offset: offset,
    });

    if (sandwiches.length === 0) {
      break;
    }

    const transformedSandwiches = sandwiches.map((sandwich) => ({
      id: sandwich.id,
      loss_transactions: sandwich.loss_transactions,
    }));

    batches.push(transformedSandwiches);
    offset += batchSize;
  }

  return batches;
}

export async function findUniqueSourceOfLossAddresses(): Promise<string[]> {
  const sandwiches = await Sandwiches.findAll({
    attributes: [[Sequelize.fn("DISTINCT", Sequelize.col("source_of_loss_contract_address")), "source_of_loss_contract_address"]],
  });
  return sandwiches.map((sandwich) => sandwich.getDataValue("source_of_loss_contract_address"));
}

export async function getAllRawTableEntriesForPoolByPoolAddress(poolAddress: string): Promise<Sandwiches[]> {
  let poolId = await getIdByAddress(poolAddress);
  return await getAllRawSandwichTableEntriesForPoolByPoolId(poolId!);
}

export async function getAllRawSandwichTableEntriesForPoolByPoolId(poolId: number): Promise<Sandwiches[]> {
  const poolRelatedSandwiches = await Sandwiches.findAll({ where: { pool_id: poolId } });
  return poolRelatedSandwiches;
}

export async function getExtractedSandwichesByPoolId(poolId: number): Promise<Sandwiches[]> {
  const extractedSandwiches = await Sandwiches.findAll({
    where: {
      pool_id: poolId,
      extracted_from_curve: true,
    },
  });
  return extractedSandwiches;
}

export const isExtractedFromCurve = async (id: number): Promise<boolean> => {
  const sandwich = await Sandwiches.findByPk(id);
  return sandwich ? sandwich.extracted_from_curve : false;
};
