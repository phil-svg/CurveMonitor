export function findUpdateCallerTokenReceivedWithdraw(receipt: any, pegKeeperAddy: string): string | null {
  const transferSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

  for (const log of receipt.logs) {
    if (
      log.topics[0] === transferSignature &&
      log.topics[1].toLowerCase() === `0x${pegKeeperAddy.toLowerCase().slice(2).padStart(64, '0')}` &&
      log.topics[2] !== '0x0000000000000000000000000000000000000000000000000000000000000000'
    ) {
      const amount = BigInt(log.data).toString();
      return amount;
    }
  }

  return null;
}

export function findUpdateCallerTokenReceivedProvide(
  receipt: any,
  pegKeeperAddy: string,
  poolAddress: string
): string | null {
  const transferSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

  for (const log of receipt.logs) {
    if (
      log.topics[0] === transferSignature &&
      log.topics[1].toLowerCase() === `0x${pegKeeperAddy.toLowerCase().slice(2).padStart(64, '0')}` &&
      log.topics[2].toLowerCase() !== `0x${poolAddress.toLowerCase().slice(2).padStart(64, '0')}`
    ) {
      const amount = BigInt(log.data).toString();
      return amount;
    }
  }

  return null;
}
