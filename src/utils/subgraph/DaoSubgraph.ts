import axios, { AxiosResponse } from 'axios';

// Define the structure of the response data
interface Proposal {
  metadata: string;
  startDate: string;
  voteType: string;
}

interface QueryResponse {
  data: {
    proposals: Proposal[];
  };
}

// Function to perform the GraphQL query
async function fetchGraphQLData(query: string): Promise<QueryResponse> {
  const url = 'https://api.thegraph.com/subgraphs/name/convex-community/curve-dao';
  const response: AxiosResponse<QueryResponse> = await axios.post(url, { query });
  return response.data;
}

// Function to get the result using the specified query
async function getDaoQueryResult() {
  const query = `{
    proposals(orderBy: startDate, orderDirection: desc, where: { executed: true }) {
      metadata
      startDate
      voteType
    }
  }`;

  const result = await fetchGraphQLData(query);
  return result.data.proposals.filter((proposal) => proposal.voteType === 'PARAMETER');
}

export async function getLatestEventTimestampFromSubgraph(): Promise<string> {
  const PROPOSALS = await getDaoQueryResult();
  const latestTimestamp = Math.max(...PROPOSALS.map((PROPOSALS) => parseInt(PROPOSALS.startDate)));
  return latestTimestamp.toString();
}
