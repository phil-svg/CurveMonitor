import { Op } from "sequelize";
import { AbisEthereum } from "../../../models/Abi.js";

export async function readAbiFromAbisEthereumTable(contractAddress: string): Promise<any[] | null> {
  const record = await AbisEthereum.findOne({
    where: {
      contract_address: {
        [Op.iLike]: contractAddress,
      },
    },
  });

  // Return the ABI if found, otherwise return null
  return record ? record.abi : null;
}

export async function getAbiFromAbisEthereum(contractAddress: string): Promise<AbisEthereum | null> {
  return await AbisEthereum.findOne({
    where: {
      contract_address: {
        [Op.iLike]: contractAddress,
      },
    },
  });
}

export async function isContractVerified(contractAddress: string): Promise<boolean> {
  const record = await AbisEthereum.findOne({
    where: {
      contract_address: {
        [Op.iLike]: contractAddress,
      },
    },
  });

  return record ? record.is_verified === true : false;
}
