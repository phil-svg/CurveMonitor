import { Receipts } from "../../../models/Receipts.js";
export async function getShortenReceiptByTxHash(txHash) {
    const records = await Receipts.findAll({
        where: { transactionHash: txHash },
        attributes: ["transactionIndex", "type", "logsBloom", "address", "data", "logIndex", "removed", "topics", "from", "to"],
        order: [["logIndex", "ASC"]],
    });
    if (records.length === 0) {
        return null; // No receipts found for this transaction hash
    }
    // Construct the Receipt object
    const receipt = {
        transactionIndex: records[0].transactionIndex,
        type: records[0].type,
        logsBloom: records[0].logsBloom,
        logs: records.map((record) => ({
            address: record.address,
            data: record.data,
            logIndex: record.logIndex,
            removed: record.removed,
            topics: record.topics,
            from: record.from,
            to: record.to,
        })),
    };
    return receipt;
}
export async function getReceiptByTxHash(txHash) {
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
    const receipt = {
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
export async function getGasUsedFromReceipt(txHash) {
    const receipt = await Receipts.findOne({
        where: {
            transactionHash: txHash,
        },
    });
    if (receipt) {
        return receipt.gasUsed;
    }
    else {
        return null;
    }
}
//# sourceMappingURL=Receipts.js.map