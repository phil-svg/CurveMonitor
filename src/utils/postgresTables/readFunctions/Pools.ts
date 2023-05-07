import { Pool } from '../../../models/Pools.js';

export const getIdByAddress = async (poolAddress: string): Promise<number | null> => {
  const pool = await Pool.findOne({ where: { address: poolAddress } });
  return pool ? pool.id : null;
};

export const getPoolBy = async (options: { id?: number; address?: string }): Promise<Pool | null> => {
  if (options.id) {
    return await Pool.findByPk(options.id);
  } else if (options.address) {
    return await Pool.findOne({ where: { address: options.address } });
  } else {
    throw new Error('You must provide either id or address');
  }
};

export const getAllPoolIds = async (): Promise<number[]> => {
  const pools = await Pool.findAll();
  const poolIds = pools.map((pool) => pool.id);
  return poolIds;
};

export const getAllPoolAddresses = async (): Promise<string[]> => {
  const pools = await Pool.findAll();
  const poolAddresses = pools.map((pool) => pool.address);
  return poolAddresses;
};

export const getAddressById = async (id: number): Promise<string | null> => {
  const pool = await Pool.findByPk(id);
  return pool?.address ?? null;
};

export const getV1PoolAddresses = async (): Promise<string[]> => {
  const pools = await Pool.findAll({ where: { version: "v1" } });
  const poolAddresses = pools.map((pool) => pool.address);
  return poolAddresses;
};

export const getV2PoolAddresses = async (): Promise<string[]> => {
  const pools = await Pool.findAll({ where: { version: "v2" } });
  const poolAddresses = pools.map((pool) => pool.address);
  return poolAddresses;
};

export const getNameBy = async (options: { id?: number; address?: string }): Promise<string | null> => {
  const pool = await getPoolBy(options);
  return pool?.name ?? null;
};

export const getNCoinsBy = async (options: { id?: number; address?: string }): Promise<number | null> => {
  const pool = await getPoolBy(options);
  return pool?.n_coins ?? null;
};

export const getCoinsBy = async (options: { id?: number; address?: string }): Promise<string[] | null> => {
  const pool = await getPoolBy(options);
  return pool?.coins ?? null;
};

export const getLpTokenBy = async (options: { id?: number; address?: string }): Promise<string | null> => {
  const pool = await getPoolBy(options);
  return pool?.lp_token ?? null;
};

export const getVersionBy = async (options: { id?: number; address?: string }): Promise<string | null> => {
  const pool = await getPoolBy(options);
  return pool?.version ?? null;
};

export const getBasePoolBy = async (options: { id?: number; address?: string }): Promise<string | null> => {
  const pool = await getPoolBy(options);
  return pool?.base_pool ?? null;
};

export const getSourceAddressBy = async (options: { id?: number; address?: string }): Promise<string | null> => {
  const pool = await getPoolBy(options);
  return pool?.source_address ?? null;
};

export const getInceptionBlockBy = async (options: { id?: number; address?: string }): Promise<number | null> => {
  const pool = await getPoolBy(options);
  return pool?.inception_block ?? null;
};

export const getCreationTimestampBy = async (options: { id?: number; address?: string }): Promise<number | null> => {
  const pool = await getPoolBy(options);
  return pool?.creation_timestamp ?? null;
};