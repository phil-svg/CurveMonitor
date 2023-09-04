import { getTxHashByTxId } from "../../readFunctions/Transactions.js";
import { solveAtomicArbForTxHash } from "./utils/atomicArbDetection.js";

export async function updateAtomicArbDetection() {
  // const txHash = "0x66a519ad66d33e5e343ac81d4246173e1ac0ec819c1d6b243b32522ee5a2fd12"; // guy withdrawing from pool, receives 3 Token.
  // const txHash = "0x1c7e8861744c00a063295987b69bbb82e1bab9c1afd438219cfa5a8d3f98dbdf"; // Balancer, Uni v2, Uni v3, Curve
  // const txHash = "0x8e12959dc243c3ff24dfae0ea7cdad48f6cfc1117c349cdc1742df3ae3a3279b"; // todo
  // const txHash = "0x8e12959dc243c3ff24dfae0ea7cdad48f6cfc1117c349cdc1742df3ae3a3279b"; // todo
  // const txHash = "0xf0607901716acb0086a58e52464d4b481b386e348214bf8fae300c3fc3a6e423"; // todo

  // const txId = 10;
  // const txHash = await getTxHashByTxId(txId);
  // await solveAtomicArbForTxHash(txHash!);

  for (let txId = 0; txId < 100; txId++) {
    console.log(txId);
    const txHash = await getTxHashByTxId(txId);
    await solveAtomicArbForTxHash(txHash!);
  }

  //process.exit();
}
