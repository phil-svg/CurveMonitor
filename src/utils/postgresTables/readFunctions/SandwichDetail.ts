import { TransactionDetail } from '../../Interfaces.js';

export interface UserLossDetail {
    unit: string;
    unitAddress: string;
    amount: number;
    lossInPercentage: number;
  }
  
  export interface SandwichDetail {
    frontrun: TransactionDetail;
    center: TransactionDetail[];
    backrun: TransactionDetail;
    user_losses_details: UserLossDetail[];
    label: string;
    poolAddress: string;
    poolName: string;
    lossInUsd: number;
  }
  
  export interface SandwichTableContent {
    data: SandwichDetail[];
    totalSandwiches: number;
  }