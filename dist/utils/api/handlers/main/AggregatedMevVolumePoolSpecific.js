import { getPoolSpecificAggregatedMevVolume } from '../../queries/AggregatedMevVolume.js';
export const handlePoolSpecificAggregatedMevVolume = (socket) => {
    socket.on('getPoolSpecificAggregatedMevVolume', async (poolAddress, timeDuration, timeInterval) => {
        try {
            const data = await getPoolSpecificAggregatedMevVolume(poolAddress, timeDuration, timeInterval);
            socket.emit('poolSpecificAggregatedMevVolume', { data });
        }
        catch (error) {
            console.error(error);
            socket.emit('error', 'Internal Server Error');
        }
    });
};
//# sourceMappingURL=AggregatedMevVolumePoolSpecific.js.map