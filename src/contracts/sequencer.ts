export const SEQUENCER_ABI = [
  // Core required functions for the challenge
  {
    "inputs": [],
    "name": "numJobs",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "_index", "type": "uint256"}],
    "name": "jobAt", 
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  // Additional useful functions for comprehensive monitoring
  {
    "inputs": [
      {"internalType": "uint256", "name": "_start", "type": "uint256"},
      {"internalType": "uint256", "name": "_end", "type": "uint256"}
    ],
    "name": "getNextJobs",
    "outputs": [{"internalType": "address[]", "name": "", "type": "address[]"}],
    "stateMutability": "view", 
    "type": "function"
  },
  {
    "inputs": [],
    "name": "activeJobs",
    "outputs": [{"internalType": "address[]", "name": "", "type": "address[]"}],
    "stateMutability": "view",
    "type": "function"
  }
];

export const JOB_ABI = [
  // IJob interface functions
  {
    "inputs": [],
    "name": "workable",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "work", 
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Known job addresses from the MakerDAO documentation
export const KNOWN_JOBS = {
  AutoLineJob: '0x67AD4000e73579B9725eE3A149F85C4Af0A61361',
  LerpJob: '0x8F8f2FC1F0380B9Ff4fE5c3142d0811aC89E32fB', 
  D3MJob: '0x2Ea4aDE144485895B923466B4521F5ebC03a0AeF',
  ClipperMomJob: '0x7E93C4f61C8E8874e7366cDbfeFF934Ed089f9fF',
  OracleJob: '0xe717Ec34b2707fc8c226b34be5eae8482d06ED03',
  FlapJob: '0xc32506E9bB590971671b649d9B8e18CB6260559F',
};

export const JOB_DESCRIPTIONS = {
  [KNOWN_JOBS.AutoLineJob]: 'AutoLine Job - Manages debt ceiling adjustments automatically',
  [KNOWN_JOBS.LerpJob]: 'Lerp Job - Handles linear interpolation parameter changes',
  [KNOWN_JOBS.D3MJob]: 'D3M Job - Manages Direct Deposit Dai Module operations',
  [KNOWN_JOBS.ClipperMomJob]: 'Clipper Mom Job - Emergency circuit breaker for auctions',
  [KNOWN_JOBS.OracleJob]: 'Oracle Job - Price feed updates and oracle maintenance',
  [KNOWN_JOBS.FlapJob]: 'Flap Job - Surplus auction management',
};