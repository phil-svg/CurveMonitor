import { fetchTransactionsBatch } from "../readFunctions/Transactions.js";
import { enrichCandidateWithCoinInfo, enrichCandidateWithSymbol } from "./SandwichHelper.js";
async function detectSandwichesInAllTransactions() {
    const BATCH_SIZE = 10000;
    let offset = 0;
    while (true) {
        const transactions = await fetchTransactionsBatch(offset, BATCH_SIZE);
        if (transactions.length === 0)
            break;
        await findCandidatesInBatch(transactions);
        offset += BATCH_SIZE;
    }
}
async function findCandidatesInBatch(batch) {
    const groups = {};
    // group transactions by `block_number` and `pool_id`
    for (const transaction of batch) {
        const key = `${transaction.block_number}-${transaction.pool_id}`;
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(transaction);
    }
    await searchInCandidatesClusterForSandwiches(groups);
}
async function searchInCandidatesClusterForSandwiches(groups) {
    for (const key in groups) {
        const candidate = groups[key];
        if (candidate.length > 1) {
            await scanCandidate(candidate);
        }
    }
}
let manualStopper = -1;
async function scanCandidate(candidate) {
    let candidateWithCoinInfo = await enrichCandidateWithCoinInfo(candidate); // adds info about coins involved
    if (!candidateWithCoinInfo)
        return;
    candidate = await enrichCandidateWithSymbol(candidateWithCoinInfo);
    manualStopper++;
    if (manualStopper < 9)
        return;
    if (manualStopper > 9)
        return;
    console.log(`Current Candidate with ${candidate.length} entries.`);
    // console.log("candidate", candidate);
    if (candidate.length === 2) {
        await candidateLength2(candidate);
        return;
    }
    if (candidate.length === 3) {
        await candidateLength3(candidate);
        return;
    }
    console.log(candidate, "manualStopper", manualStopper);
}
async function candidateLength2(candidate) {
    const GAP_IN_BLOCK = Math.abs(candidate[0].tx_position - candidate[1].tx_position);
    if (GAP_IN_BLOCK === 0) {
        console.log(`Aborted, since it was in fact a single tx.`);
        return;
    }
    if (GAP_IN_BLOCK === 1) {
        console.log(`Aborted, since it was a follow up tx.`);
        return;
    }
    if (GAP_IN_BLOCK !== 2) {
        console.log(`Aborted, since gap is ${GAP_IN_BLOCK}.`);
        return;
    }
    console.log(candidate, "manualStopper", manualStopper);
}
async function candidateLength3(candidate) {
    candidate.sort((a, b) => a.tx_position - b.tx_position);
    let i = 0;
    let flag = false;
    while (i < candidate.length - 1) {
        if (candidate[i + 1].tx_position === candidate[i].tx_position + 1) {
            if (i < candidate.length - 2 && candidate[i + 2].tx_position === candidate[i].tx_position + 2) {
                console.log("Found candidateWithThreeConsecutiveTransactions");
                await candidateWithThreeConsecutiveTransactions([candidate[i], candidate[i + 1], candidate[i + 2]]);
                flag = true;
                i += 3;
            }
            else {
                i++;
            }
            continue;
        }
        if (candidate[i + 1].tx_position === candidate[i].tx_position + 2) {
            console.log("Found candidateLength2 in length=3");
            await candidateLength2([candidate[i], candidate[i + 1]]);
            flag = true;
            i += 2;
            continue;
        }
        if (candidate[i + 1].tx_position > candidate[i].tx_position + 2) {
            i++;
            continue;
        }
    }
    if (!flag) {
        console.log(`Aborted, since no logical gap was found.`);
    }
}
async function candidateWithThreeConsecutiveTransactions(candidate) {
    console.log("candidate in candidateWithThreeConsecutiveTransactions");
    console.dir(candidate, { depth: null, colors: true });
}
export async function updateSandwichDetection() {
    console.log("Running Sandwich Detection..\n\n\n");
    await detectSandwichesInAllTransactions();
    console.log("\n\n\n[✓] Sandwich-Detection completed successfully.\n");
}
//# sourceMappingURL=SandwichDetection.js.map