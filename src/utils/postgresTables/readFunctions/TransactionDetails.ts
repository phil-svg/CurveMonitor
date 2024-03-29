import { Op, Sequelize } from "sequelize";
import { TransactionDetails } from "../../../models/TransactionDetails.js";

export async function getFromAddress(txId: number): Promise<string | null> {
  const transactionDetails = await TransactionDetails.findByPk(txId);
  if (transactionDetails) {
    return transactionDetails.from;
  }
  return null;
}

export async function getToAddress(txId: number): Promise<string | null> {
  const transactionDetails = await TransactionDetails.findByPk(txId);
  if (transactionDetails) {
    return transactionDetails.to;
  }
  return null;
}

export async function getTransactionDetails(txId: number): Promise<TransactionDetails | null> {
  const transactionDetails = await TransactionDetails.findByPk(txId);
  return transactionDetails || null;
}

export async function getTransactionDetailsByTxId(txId: number): Promise<TransactionDetails | null> {
  const transactionDetails = await TransactionDetails.findByPk(txId);
  return transactionDetails || null;
}

export function extractTransactionAddresses(transactionDetails: TransactionDetails | null): { from: string | null; to: string | null } {
  if (transactionDetails) {
    return { from: transactionDetails.from, to: transactionDetails.to };
  }
  return { from: null, to: null };
}

export function extractGasPrice(transactionDetails: TransactionDetails | null): string | null {
  if (transactionDetails) {
    return transactionDetails.gasPrice;
  }
  return null;
}

export async function getBlockNumberByTxHash(hash: string): Promise<number | null> {
  const transactionDetail = await TransactionDetails.findOne({ where: { hash: hash } });

  if (transactionDetail) {
    return transactionDetail.blockNumber;
  }

  return null;
}

export async function countTransactionsToAddress(address: string): Promise<number> {
  const count = await TransactionDetails.count({
    where: {
      to: {
        [Op.iLike]: address,
      },
    },
  });

  return count;
}

export async function getTxdsForRequestedToAddress(address: string): Promise<number[]> {
  const transactions = await TransactionDetails.findAll({
    attributes: ["txId"],
    where: {
      to: {
        [Op.iLike]: address,
      },
    },
  });

  return transactions.map((transaction) => transaction.txId);
}

export async function findAndCountUniqueCallesPlusCalledContracts(): Promise<{ address: string; count: number }[]> {
  try {
    const addresses = await TransactionDetails.findAll({
      attributes: [
        [Sequelize.fn("DISTINCT", Sequelize.col("from")), "address"],
        [Sequelize.fn("COUNT", Sequelize.col("from")), "count"],
      ],
      group: "from",
      raw: true,
    });

    const toAddresses = await TransactionDetails.findAll({
      attributes: [
        [Sequelize.fn("DISTINCT", Sequelize.col("to")), "address"],
        [Sequelize.fn("COUNT", Sequelize.col("to")), "count"],
      ],
      group: "to",
      raw: true,
    });

    // Define a type for the accumulator
    type AddressCountMap = Record<string, number>;

    // Combine and reduce the arrays to sum up counts for each address
    const combinedAddresses = [...addresses, ...toAddresses];
    const addressCounts = combinedAddresses.reduce((acc: AddressCountMap, curr: any) => {
      const address = curr.address as string;
      const count = parseInt(curr.count, 10);
      acc[address] = (acc[address] || 0) + count;
      return acc;
    }, {} as AddressCountMap);

    // Convert the object back into an array
    return Object.entries(addressCounts).map(([address, count]) => ({ address, count }));
  } catch (error) {
    console.error("Error fetching address occurrence counts:", error);
    return [];
  }
}

export async function getAddressOccurrenceCounts(): Promise<{ address: string; count: number }[]> {
  try {
    const addresses = await TransactionDetails.findAll({
      attributes: [
        [Sequelize.fn("DISTINCT", Sequelize.col("from")), "address"],
        [Sequelize.fn("COUNT", Sequelize.col("from")), "count"],
      ],
      group: "from",
      raw: true,
    });

    const toAddresses = await TransactionDetails.findAll({
      attributes: [
        [Sequelize.fn("DISTINCT", Sequelize.col("to")), "address"],
        [Sequelize.fn("COUNT", Sequelize.col("to")), "count"],
      ],
      group: "to",
      raw: true,
    });

    // Define a type for the accumulator
    type AddressCountMap = Record<string, number>;

    // Combine and reduce the arrays to sum up counts for each address
    const combinedAddresses = [...addresses, ...toAddresses];
    const addressCounts = combinedAddresses.reduce((acc: AddressCountMap, curr: any) => {
      const address = curr.address as string;
      const count = parseInt(curr.count, 10);
      acc[address] = (acc[address] || 0) + count;
      return acc;
    }, {} as AddressCountMap);

    // Convert the object back into an array
    return Object.entries(addressCounts).map(([address, count]) => ({ address, count }));
  } catch (error) {
    console.error("Error fetching address occurrence counts:", error);
    return [];
  }
}
