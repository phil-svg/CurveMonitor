import { Receipts } from "../../../models/Receipts.js";

interface Log {
  receipt_id: number;
  address: string;
  data: string;
  logIndex: number;
  removed: boolean;
  topics: string[];
  id: string;
  contractAddress?: string | null;
  from: string;
  status?: string;
  to: string;
}

interface Receipt {
  tx_id: number;
  transactionHash: string;
  blockHash: string;
  blockNumber: string;
  transactionIndex: string;
  effectiveGasPrice: string;
  cumulativeGasUsed: string;
  gasUsed: string;
  type: string;
  logsBloom?: string;
  logs: Log[];
}

export async function getReceiptByTxHash(txHash: string): Promise<Receipt | null> {
  const records = await Receipts.findAll({
    where: { transactionHash: txHash },
    attributes: [
      "receipt_id",
      "tx_id",
      "transactionHash",
      "blockHash",
      "blockNumber",
      "transactionIndex",
      "effectiveGasPrice",
      "cumulativeGasUsed",
      "gasUsed",
      "type",
      "logsBloom",
      "address",
      "data",
      "logIndex",
      "removed",
      "topics",
      "id",
      "contractAddress",
      "from",
      "status",
      "to",
    ],
    order: [["logIndex", "ASC"]],
  });

  if (records.length === 0) {
    return null; // No receipts found for this transaction hash
  }

  // Construct the Receipt object
  const receipt: Receipt = {
    tx_id: records[0].tx_id,
    transactionHash: records[0].transactionHash,
    blockHash: records[0].blockHash,
    blockNumber: records[0].blockNumber,
    transactionIndex: records[0].transactionIndex,
    effectiveGasPrice: records[0].effectiveGasPrice,
    cumulativeGasUsed: records[0].cumulativeGasUsed,
    gasUsed: records[0].gasUsed,
    type: records[0].type,
    logsBloom: records[0].logsBloom,
    logs: records.map((record) => ({
      receipt_id: record.receipt_id,
      address: record.address,
      data: record.data,
      logIndex: record.logIndex,
      removed: record.removed,
      topics: record.topics,
      id: record.id,
      contractAddress: record.contractAddress,
      from: record.from,
      status: record.status,
      to: record.to,
    })),
  };

  return receipt;
}

export async function getGasUsedFromReceipt(txHash: string): Promise<string | null> {
  const receipt = await Receipts.findOne({
    where: {
      transactionHash: txHash,
    },
  });

  if (receipt) {
    return receipt.gasUsed;
  } else {
    return null;
  }
}
