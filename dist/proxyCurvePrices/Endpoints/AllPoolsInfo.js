import { QueryTypes } from 'sequelize';
import { sequelize } from '../../config/Database.js';
export async function fetchPoolsWithCoins() {
    const query = `
    SELECT
      p.address,
      p.name,
      p.n_coins,
      p.lp_token,
      p.base_pool,
      (SELECT JSON_AGG(
        JSON_BUILD_OBJECT(
          'address', c.address,
          'symbol', c.symbol,
          'decimals', c.decimals
        )
      ) FROM coins c WHERE c.address = ANY(p.coins)) AS coins_details
    FROM
      pools p;
  `;
    try {
        const result = (await sequelize.query(query, { type: QueryTypes.SELECT }));
        return result;
    }
    catch (error) {
        console.error('Error fetching pools with coins:', error);
        return [];
    }
}
//# sourceMappingURL=AllPoolsInfo.js.map