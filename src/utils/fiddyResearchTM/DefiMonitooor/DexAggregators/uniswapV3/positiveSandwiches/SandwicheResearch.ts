import { getUniswapV3Contract } from '../ContractGetter.js';
import { MintEventUniV3, SimplifiedUniV3SwapEvent, SwapEventUniV3 } from './Utils.js';

function findGroupsWithDoubledUser(events: SimplifiedUniV3SwapEvent[]) {
  // Group by blockNumber
  const groupedByBlock = events.reduce(
    (acc, event) => {
      if (!acc[event.blockNumber]) {
        acc[event.blockNumber] = [];
      }
      acc[event.blockNumber].push(event);
      return acc;
    },
    {} as { [blockNumber: number]: SimplifiedUniV3SwapEvent[] }
  );

  // Sort each group by position
  Object.keys(groupedByBlock).forEach((blockNumber) => {
    groupedByBlock[parseInt(blockNumber)].sort((a, b) => a.position - b.position);
  });

  // Filter groups with at least 3 members
  const filteredforMin3MembersPerGroup = Object.fromEntries(
    Object.entries(groupedByBlock).filter(([_, group]) => group.length >= 3)
  );

  //   console.dir(filteredforMin3MembersPerGroup, { depth: null, colors: true });
  //   console.log('Found', Object.keys(filteredforMin3MembersPerGroup).length, 'groups with at least 3 members');

  // Find consecutive transaction sequences
  const groupsWithConsecutiveTransactions = Object.entries(filteredforMin3MembersPerGroup)
    .map(([blockNumber, group]) => {
      const consecutiveGroups = [];
      let currentGroup = [group[0]];

      for (let i = 1; i < group.length; i++) {
        if (group[i].position === group[i - 1].position + 1) {
          currentGroup.push(group[i]);
        } else {
          if (currentGroup.length >= 3) {
            consecutiveGroups.push(currentGroup);
          }
          currentGroup = [group[i]];
        }
      }

      // Check if the last group meets the criteria
      if (currentGroup.length >= 3) {
        consecutiveGroups.push(currentGroup);
      }

      return { blockNumber, consecutiveGroups };
    })
    .filter(({ consecutiveGroups }) => consecutiveGroups.length > 0); // Only keep groups that have at least one sequence of 3 or more consecutive transactions

  //   console.dir(groupsWithConsecutiveTransactions, { depth: null, colors: true });
  //   console.log(
  //     'Found',
  //     Object.keys(groupsWithConsecutiveTransactions).length,
  //     'groups with at least 3 consecutive members'
  //   );

  const groupsWithDoubledUser = groupsWithConsecutiveTransactions
    .map((group) => {
      return {
        blockNumber: group.blockNumber,
        // Filter the consecutiveGroups to include only those where not all users are unique
        consecutiveGroups: group.consecutiveGroups.filter((consecutiveGroup) => {
          const users = consecutiveGroup.map((event) => event.user);
          const uniqueUsers = new Set(users);
          // If the number of unique users is less than the total number of users, there's a repeat
          return uniqueUsers.size < users.length;
        }),
      };
    })
    .filter((group) => group.consecutiveGroups.length > 0); // Filter out any groups that now have no consecutive groups

  return groupsWithDoubledUser;
}

// Function to determine swap direction and calculate amounts
function formatEvents(events: SwapEventUniV3[]): SimplifiedUniV3SwapEvent[] {
  return events.map((event) => {
    const soldToken = Number(event.returnValues.amount0) > 0 ? 'WETH' : 'USDT';
    const boughtToken = Number(event.returnValues.amount0) < 0 ? 'WETH' : 'USDT';

    const parsedEthAmount = Math.abs(Number(event.returnValues.amount0) / 1e18);
    const parsedUSDCAmount = Math.abs(Number(event.returnValues.amount1) / 1e6);

    const formattedSoldAmount = soldToken === 'WETH' ? parsedEthAmount : parsedUSDCAmount;
    const formattedBoughtAmount = soldToken === 'WETH' ? parsedUSDCAmount : parsedEthAmount;

    const swapDirection = soldToken === 'WETH' ? 'WETH -> USDT' : 'USDT -> WETH';

    return {
      txHash: event.transactionHash,
      blockNumber: event.blockNumber,
      position: event.transactionIndex,
      unixTime: parseInt(event.blockTimestamp, 16),
      sold: soldToken,
      bought: boughtToken,
      swap: swapDirection,
      soldAmount: formattedSoldAmount,
      boughtAmount: formattedBoughtAmount,
      user: event.returnValues.sender,
      inputTokenId: soldToken === 'WETH' ? 'token0' : 'token1',
      outputTokenId: soldToken === 'WETH' ? 'token1' : 'token0',
    };
  });
}

async function getMintEvents(allEvents: any[]): Promise<MintEventUniV3[]> {
  // Filter events to only include those with the event name 'Mint'
  const mintEvents = allEvents
    .filter((event) => event.event === 'Mint')
    .map((event) => {
      return {
        address: event.address,
        blockHash: event.blockHash,
        blockNumber: event.blockNumber,
        blockTimestamp: event.blockTimestamp,
        transactionHash: event.transactionHash,
        transactionIndex: event.transactionIndex,
        logIndex: event.logIndex,
        removed: event.removed,
        id: event.id,
        returnValues: {
          '0': event.returnValues['0'],
          '1': event.returnValues['1'],
          '2': event.returnValues['2'],
          '3': event.returnValues['3'],
          '4': event.returnValues['4'],
          '5': event.returnValues['5'],
          '6': event.returnValues['6'],
          sender: event.returnValues.sender,
          owner: event.returnValues.owner,
          tickLower: event.returnValues.tickLower,
          tickUpper: event.returnValues.tickUpper,
          amount: event.returnValues.amount,
          amount0: event.returnValues.amount0,
          amount1: event.returnValues.amount1,
        },
        event: event.event,
        signature: event.signature,
        raw: {
          data: event.raw.data,
          topics: event.raw.topics,
        },
      };
    });

  return mintEvents;
}

async function getSwapEvents(allEvents: any[]): Promise<SwapEventUniV3[]> {
  // Filter events to only include those with the event name 'Swap'
  const swapEvents = allEvents
    .filter((event) => event.event === 'Swap')
    .map((event) => {
      return {
        address: event.address,
        blockHash: event.blockHash,
        blockNumber: event.blockNumber,
        blockTimestamp: event.blockTimestamp,
        transactionHash: event.transactionHash,
        transactionIndex: event.transactionIndex,
        logIndex: event.logIndex,
        removed: event.removed,
        id: event.id,
        returnValues: {
          '0': event.returnValues['0'],
          '1': event.returnValues['1'],
          '2': event.returnValues['2'],
          '3': event.returnValues['3'],
          '4': event.returnValues['4'],
          '5': event.returnValues['5'],
          '6': event.returnValues['6'],
          sender: event.returnValues.sender,
          recipient: event.returnValues.recipient,
          amount0: event.returnValues.amount0,
          amount1: event.returnValues.amount1,
          sqrtPriceX96: event.returnValues.sqrtPriceX96,
          liquidity: event.returnValues.liquidity,
          tick: event.returnValues.tick,
        },
        event: event.event,
        signature: event.signature,
        raw: {
          data: event.raw.data,
          topics: event.raw.topics,
        },
      };
    });

  return swapEvents;
}

async function getEvents(): Promise<SwapEventUniV3[]> {
  const addressUniV3_WETH_USDC_005 = '0x11b815efB8f581194ae79006d24E0d814B7697F6';
  const poolContract = getUniswapV3Contract(addressUniV3_WETH_USDC_005);

  const blocksPerMinute = 5;
  const minutes = 60 * 24 * 7;
  const toBlock = 20425147;
  const fromBlock = toBlock - blocksPerMinute * minutes;

  // const toBlock = 20422753;
  // const fromBlock = 20422753;

  const swapEvents: any[] = await poolContract.getPastEvents('allEvents', { fromBlock, toBlock });
  return swapEvents;
}

function filterGroupsWithoutMintedTxHash(
  mintEvents: MintEventUniV3[],
  groupsWithDoubledUser: {
    blockNumber: string;
    consecutiveGroups: SimplifiedUniV3SwapEvent[][];
  }[]
): {
  blockNumber: string;
  consecutiveGroups: SimplifiedUniV3SwapEvent[][];
}[] {
  const mintTxHashes = mintEvents.map((mint) => mint.transactionHash);

  return groupsWithDoubledUser
    .map((group) => {
      return {
        blockNumber: group.blockNumber,
        consecutiveGroups: group.consecutiveGroups.filter((groupArray) => {
          const firstTxHash = groupArray[0].txHash;
          const lastTxHash = groupArray[groupArray.length - 1].txHash;
          return !mintTxHashes.includes(firstTxHash) && !mintTxHashes.includes(lastTxHash);
        }),
      };
    })
    .filter((group) => group.consecutiveGroups.length > 0);
}

export async function uniswapV3positiveSandwichThings() {
  console.log('fetching...');
  const allEvents = await getEvents();
  const swapEvents = await getSwapEvents(allEvents);
  const mintEvents = await getMintEvents(allEvents);

  const formattedEvents = formatEvents(swapEvents);

  const groupsWithDoubledUser = findGroupsWithDoubledUser(formattedEvents);
  // console.dir(groupsWithDoubledUser, { depth: null, colors: true });
  console.log('Found', Object.keys(groupsWithDoubledUser).length, 'groups with doubled user');

  const probSammich = filterGroupsWithoutMintedTxHash(mintEvents, groupsWithDoubledUser);
  // console.dir(probSammich, { depth: null, colors: true });
  console.log('found', mintEvents.length, 'Mint-Events');
  console.log('found', swapEvents.length, 'Swap-Events');
  console.log('Found', Object.keys(probSammich).length, 'potential sandwiches');
}
