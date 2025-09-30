
interface TransactionData {
  SETTLED?: number;
  FAILED?: number;
  AUTHORIZED?: number;
  PENDING?: number;
}

interface EzetapApiResponse {
  [orgCode: string]: TransactionData;
}

interface ProcessedMerchantData {
  orgCode: string;
  successfulTxns: number;
  failedTxns: number;
  pendingTxns: number;
  healthStatus: 'Good' | 'Warning' | 'Critical' | 'Unknown';
  healthColor: string;
}

const calculateHealthStatus = (successful: number, failed: number) => {
  const total = successful + failed;
  if (total === 0) return { status: 'Unknown', color: '#9E9E9E' };
  
  const failureRate = failed / total;
  if (failureRate < 0.05) return { status: 'Good', color: '#4CAF50' };
  if (failureRate < 0.15) return { status: 'Warning', color: '#FF9800' };
  return { status: 'Critical', color: '#F44336' };
};

const processEzetapResponse = (ezetapData: EzetapApiResponse): ProcessedMerchantData[] => {
  return Object.entries(ezetapData).map(([orgCode, txnData]) => {
    const successfulTxns = (txnData.AUTHORIZED || 0) + (txnData.SETTLED || 0);
        
    const failedTxns = txnData.FAILED || 0;
    
    const pendingTxns = txnData.PENDING || 0;
    
    const health = calculateHealthStatus(successfulTxns, failedTxns);
    
    return {
      orgCode,
      successfulTxns,
      failedTxns,
      pendingTxns,
      healthStatus: health.status as 'Good' | 'Warning' | 'Critical' | 'Unknown',
      healthColor: health.color
    };
  });
};

export { calculateHealthStatus, processEzetapResponse, ProcessedMerchantData, EzetapApiResponse };