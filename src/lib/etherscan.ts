/**
 * Etherscan API Client for fetching transaction history
 */

export interface EtherscanTransaction {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  isError: string;
  txreceipt_status: string;
  contractAddress: string;
  confirmations: string;
}

export interface EtherscanResponse {
  status: string;
  message: string;
  result: EtherscanTransaction[] | string;
}

const ETHERSCAN_API_URLS: Record<number, string> = {
  1: 'https://api.etherscan.io/api',
  11155111: 'https://api-sepolia.etherscan.io/api',
};

export function getEtherscanApiUrl(chainId: number): string | null {
  return ETHERSCAN_API_URLS[chainId] || null;
}

export async function getTransactionHistory(
  address: string,
  chainId: number,
  apiKey: string,
  options: {
    startBlock?: number;
    endBlock?: number;
    page?: number;
    offset?: number;
    sort?: 'asc' | 'desc';
  } = {}
): Promise<EtherscanTransaction[]> {
  const baseUrl = getEtherscanApiUrl(chainId);
  if (!baseUrl) {
    throw new Error(`Etherscan not supported for chain ${chainId}`);
  }

  const params = new URLSearchParams({
    module: 'account',
    action: 'txlist',
    address: address,
    startblock: String(options.startBlock || 0),
    endblock: String(options.endBlock || 99999999),
    page: String(options.page || 1),
    offset: String(options.offset || 50),
    sort: options.sort || 'desc',
    apikey: apiKey,
  });

  const response = await fetch(`${baseUrl}?${params}`);
  
  if (!response.ok) {
    throw new Error(`Etherscan API error: ${response.status}`);
  }

  const data: EtherscanResponse = await response.json();

  if (data.status !== '1') {
    if (data.message === 'No transactions found') {
      return [];
    }
    throw new Error(`Etherscan error: ${data.message}`);
  }

  if (!Array.isArray(data.result)) {
    return [];
  }

  return data.result;
}
