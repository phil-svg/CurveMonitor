import axios from "axios";
// Function to perform the GraphQL query
async function fetchGraphQLData(query) {
    const url = "https://api.thegraph.com/subgraphs/name/convex-community/curve-dao";
    const response = await axios.post(url, { query });
    return response.data;
}
// Function to get the result using the specified query
export async function getDaoQueryResult() {
    const query = `{
    proposals(orderBy: startDate, orderDirection: desc, where: { executed: true }) {
      metadata
      startDate
      voteType
    }
  }`;
    const result = await fetchGraphQLData(query);
    return result.data.proposals.filter((proposal) => proposal.voteType === "PARAMETER");
}
export async function getLatestEventTimestampFromSubgraph() {
    const PROPOSALS = await getDaoQueryResult();
    const latestTimestamp = Math.max(...PROPOSALS.map((PROPOSALS) => parseInt(PROPOSALS.startDate)));
    return latestTimestamp.toString();
}
//# sourceMappingURL=DaoSubgraph.js.map