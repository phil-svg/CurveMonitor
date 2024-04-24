import Web3 from 'web3';
import { main } from '../../App.js';
import { WEB3_WS_PROVIDER } from '../web3Calls/generic.js';
import eventEmitter from './EventEmitter.js';
import { logMemoryUsage } from '../helperFunctions/QualityOfLifeStuff.js';

let subscription: any; // Holds the subscription object

export async function checkWsConnectionViaNewBlocks() {
  let lastSavedBlockNumber = 0;
  let lastReveivedBlockNumber = 0;
  subscription = WEB3_WS_PROVIDER.eth.subscribe('newBlockHeaders', async (err, blockHeader) => {
    lastReveivedBlockNumber = blockHeader.number;
    // console.log("New block", blockHeader.number);
    logMemoryUsage('checkWsConnectionViaNewBlocks');
  });
  await new Promise((resolve) => setTimeout(resolve, 20000));
  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 30000));
    if (lastSavedBlockNumber === lastReveivedBlockNumber) break;
    lastSavedBlockNumber = lastReveivedBlockNumber;
  }
  eventEmitter.emit('dead websocket connection');
  return;
}

export function setupDeadWebsocketListener() {
  eventEmitter.on('dead websocket connection', async () => {
    console.log('Dead WebSocket connection detected, restarting in 3 seconds...');
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await main();
  });
}

export async function eraseWebProvider(): Promise<void> {
  // console.log("Trying to erase Web3 Provider!");

  // Disconnect WebSocket Provider
  if (typeof WEB3_WS_PROVIDER !== 'undefined' && WEB3_WS_PROVIDER !== null) {
    const wsProvider = WEB3_WS_PROVIDER.currentProvider;
    if (wsProvider && wsProvider instanceof Web3.providers.WebsocketProvider) {
      wsProvider.disconnect(1000, 'Manual disconnect');
      console.log('WebSocket Provider disconnected.');
    }
  }
}
