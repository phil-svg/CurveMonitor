import { handlePingPong } from './Ping.js';
import { handleUserSearch } from './UserSearch.js';
import { handleAbsolutLabelsRankingRoom } from './AbsolutLabelsRanking.js';
import { handleSandwichLabelOccurrencesRoom } from './RelativeLabelsRaking.js';
import { handleSandwichGeneralLivestream } from './SandwichGeneralLivestream.js';
import { handleFullSandwichRoom } from './SandwichTableFull.js';
import { handlePoolSandwichRoom } from './SandwichTablePoolSpecfic.js';
import { handleGeneralTxLivestream } from './GeneralTxLivestream.js';
import { handlePoolTxLivestream } from './TxTablePoolSpecific.js';
import { handlePoolLabel } from './PoolLabels.js';
import { handleAtomicArbLivestream } from './AtomicArbLivestream.js';
import { handleCexDexArbLivestream } from './CexDexArbLivestream.js';
import { handleFullAtomicArbRoom } from './AtomicArbsTableFull.js';
import { handleFullCexDexArbRoom } from './CexDexArbsTableFull.js';
import { handlePoolSpecificAtomicArbRoom } from './AtomicArbTablePoolSpecific.js';
import { handlePoolSpecificCexDexArbRoom } from './CexDexArbsTablePoolSpecific.js';
import { handleAtomicArbBotLeaderBoardByTxCountForPoolAndDuration } from './AtomicArbLeaderboardPoolSpecifcByTxCount.js';
import { handleCexDexArbBotLeaderBoardByTxCountForPoolAndDuration } from './CexDexArbLeaderboardPoolSpecificByTxCount.js';
import { handlePoolSpecificAggregatedMevVolume } from './AggregatedMevVolumePoolSpecific.js';
export function startMainWsEndpoint(io) {
    const mainRoom = io.of('/main');
    mainRoom.on('connection', (socket) => {
        console.log('Client entered Main-Room.');
        handleErrors(socket);
        handlePingPong(socket);
        handleUserSearch(socket);
        handleAbsolutLabelsRankingRoom(socket);
        handleSandwichLabelOccurrencesRoom(socket);
        handleSandwichGeneralLivestream(mainRoom, socket);
        handleFullSandwichRoom(socket);
        handlePoolSandwichRoom(socket);
        handleGeneralTxLivestream(mainRoom, socket);
        handleAtomicArbLivestream(mainRoom, socket);
        handleCexDexArbLivestream(mainRoom, socket);
        handlePoolTxLivestream(socket);
        handlePoolLabel(socket);
        handleFullAtomicArbRoom(socket);
        handleFullCexDexArbRoom(socket);
        handlePoolSpecificAtomicArbRoom(socket);
        handlePoolSpecificCexDexArbRoom(socket);
        handleAtomicArbBotLeaderBoardByTxCountForPoolAndDuration(socket);
        handleCexDexArbBotLeaderBoardByTxCountForPoolAndDuration(socket);
        handlePoolSpecificAggregatedMevVolume(socket);
    });
}
function handleErrors(socket) {
    socket.on('error', (error) => {
        console.error(`Error on socket: ${error}`);
    });
}
//# sourceMappingURL=MainEndpointSetup.js.map