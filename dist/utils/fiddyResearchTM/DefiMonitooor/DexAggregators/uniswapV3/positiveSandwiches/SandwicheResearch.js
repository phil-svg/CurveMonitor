import { getUniswapV3Contract } from '../ContractGetter.js';
function findAllSandwiches(events) {
    // Group by blockNumber
    const groupedByBlock = events.reduce((acc, event) => {
        if (!acc[event.blockNumber]) {
            acc[event.blockNumber] = [];
        }
        acc[event.blockNumber].push(event);
        return acc;
    }, {});
    // Sort each group by position
    Object.keys(groupedByBlock).forEach((blockNumber) => {
        groupedByBlock[parseInt(blockNumber)].sort((a, b) => a.position - b.position);
    });
    // Filter groups with at least 3 members
    const filteredforMin3MembersPerGroup = Object.fromEntries(Object.entries(groupedByBlock).filter(([_, group]) => group.length >= 3));
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
            }
            else {
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
    console.dir(groupsWithDoubledUser, { depth: null, colors: true });
    console.log('Found', Object.keys(groupsWithDoubledUser).length, 'groups with doubled user');
    return 'foo';
}
// Function to determine swap direction and calculate amounts
function formatEvents(events) {
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
        };
    });
}
async function getEvents() {
    const addressUniV3_WETH_USDC_005 = '0x11b815efB8f581194ae79006d24E0d814B7697F6';
    const poolContract = getUniswapV3Contract(addressUniV3_WETH_USDC_005);
    const blocksPerMinute = 5;
    const minutes = 60 * 24 * 7;
    const toBlock = 20425147;
    const fromBlock = toBlock - blocksPerMinute * minutes;
    //   const toBlock = 20422753;
    //   const fromBlock = 20422753;
    const swapEvents = await poolContract.getPastEvents('Swap', { fromBlock, toBlock });
    return swapEvents;
}
export async function uniswapV3positiveSandwichThings() {
    console.log('fetching...');
    const swapEvents = await getEvents();
    const formattedEvents = formatEvents(swapEvents);
    const foo = findAllSandwiches(formattedEvents);
    console.log('found', swapEvents.length, 'Swap-Events');
}
//# sourceMappingURL=SandwicheResearch.js.map