import { Socket } from 'socket.io';
import { getPoolSpecificAggregatedMevVolume } from '../../queries/AggregatedMevVolume.js';
import { DurationInput, IntervalInput } from '../../../Interfaces.js';

export const handlePoolSpecificAggregatedMevVolume = (socket: Socket) => {
  socket.on(
    'getPoolSpecificAggregatedMevVolume',
    async (poolAddress: string, timeDuration: DurationInput, timeInterval: IntervalInput) => {
      try {
        const data = await getPoolSpecificAggregatedMevVolume(poolAddress, timeDuration, timeInterval);
        socket.emit('poolSpecificAggregatedMevVolume', { data });
      } catch (error) {
        console.error(error);
        socket.emit('error', 'Internal Server Error');
      }
    }
  );
};
