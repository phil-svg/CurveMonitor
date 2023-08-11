import { Op } from "sequelize";
import { Contracts } from "../../../models/Contracts.js";

export async function getContractInceptionTimestamp(contractAddress: string): Promise<number | null> {
  const lowerCasedAddress = contractAddress.toLowerCase();

  const contract = await Contracts.findOne({
    where: {
      contractAddress: {
        [Op.iLike]: lowerCasedAddress,
      },
    },
  });

  return contract?.contractCreationTimestamp || null;
}
