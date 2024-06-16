import { QueryTypes } from 'sequelize';
import { sequelize } from '../../../config/Database.js';
import { getProvidedAddress } from '../../AddressProviderEntryPoint.js';
export async function getPoolLaunchesLast7Days() {
    const factoryInfo = await getProvidedAddress();
    if (!factoryInfo)
        return null;
    const factoryMap = new Map(factoryInfo.map((item) => [item.address.toLowerCase(), item.description]));
    const query = `
    SELECT 
    p.address,
    p.name,
    JSON_AGG(
        JSON_BUILD_OBJECT(
            'address', c.address,
            'symbol', c.symbol,
            'decimals', c.decimals
        )
    ) AS coins,
    p.source_address,
    p.inception_block,
    p.creation_timestamp
FROM 
    pools p
LEFT JOIN 
    coins c ON c.address = ANY(p.coins)
WHERE 
    p.creation_date >= NOW() - INTERVAL '7 days'
GROUP BY 
    p.id
ORDER BY 
    p.creation_date DESC;
  `;
    try {
        const poolData = await sequelize.query(query, {
            type: QueryTypes.SELECT,
        });
        for (const pool of poolData) {
            const sourceAddressLower = pool.source_address.toLowerCase();
            pool.source_address_description = factoryMap.get(sourceAddressLower) || '0';
        }
        return poolData;
    }
    catch (error) {
        console.error('Failed to fetch pool launches from the last 7 days:', error);
        throw error;
    }
}
//# sourceMappingURL=Pools.js.map