import { solveAtomicArbForTxHash } from "./utils/atomicArbDetection.js";
export async function updateAtomicArbDetection() {
    // const txHash = "0x66a519ad66d33e5e343ac81d4246173e1ac0ec819c1d6b243b32522ee5a2fd12"; // guy withdrawing from pool, receives 3 Token.
    // const txHash = "0x1c7e8861744c00a063295987b69bbb82e1bab9c1afd438219cfa5a8d3f98dbdf"; // Balancer, Uni v2, Uni v3, Curve
    const txHash = "0x8e12959dc243c3ff24dfae0ea7cdad48f6cfc1117c349cdc1742df3ae3a3279b";
    // const txId = 9;
    // const txHash = await getTxHashByTxId(txId);
    await solveAtomicArbForTxHash(txHash);
    // for (let txId = 10; txId < 20; txId++) {
    //   const txHash = await getTxHashByTxId(txId);
    //   await solveAtomicArbForTxHash(txHash!);
    // }
}
//# sourceMappingURL=atomicArb.js.map