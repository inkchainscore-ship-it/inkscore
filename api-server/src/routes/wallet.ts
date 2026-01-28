import { Router, Request, Response } from 'express';
import { responseCache } from '../cache';
import { walletStatsService } from '../services/wallet-stats-service';
import { pointsServiceV2 } from '../services/points-service-v2';
import { priceService } from '../services/price-service';
import { query, pool } from '../db';

const router = Router();

// Validate wallet address format
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// GET /api/wallet/:address/stats
router.get('/:address/stats', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    if (!isValidAddress(address)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    const cacheKey = `wallet:stats:${address.toLowerCase()}`;
    const cached = responseCache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const stats = await walletStatsService.getAllStats(address);
    responseCache.set(cacheKey, stats);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching wallet stats:', error);
    res.status(500).json({ error: 'Failed to fetch wallet stats' });
  }
});

// ============================================
// Tydro (Lending/Borrowing) Route
// ============================================

// Tydro contract addresses (lowercase)
const TYDRO_CONTRACTS = [
  '0xde090efcd6ef4b86792e2d84e55a5fa8d49d25d2', // WrappedTokenGatewayV3 (ETH functions)
  '0x2816cf15f6d2a220e789aa011d5ee4eb6c47feba', // TydroPool (token functions)
];

// Method IDs for categorization
const TYDRO_SUPPLY_METHODS = ['0x474cf53d', '0x617ba037']; // depositETH, supply
const TYDRO_WITHDRAW_METHODS = ['0x80500d20', '0x69328dec']; // withdrawETH, withdraw
const TYDRO_BORROW_METHODS = ['0xe74f7b85', '0xa415bcad']; // borrowETH, borrow
const TYDRO_REPAY_METHODS = ['0xbcc3c255', '0x573ade81']; // repayETH, repay

// Event signatures (topic[0])
const TYDRO_SUPPLY_EVENT_TOPIC = '0x2b627736bca15cd5381dcf80b0bf11fd197d01a037c52b927a881a10fb73ba61';
const TYDRO_WITHDRAW_EVENT_TOPIC = '0x3115d1449a7b732c986cba18244e897a450f61e1bb8d589cd2e69e6c8924f9f7';
const TYDRO_BORROW_EVENT_TOPIC = '0xb3d084820fb1a9decffb176436bd02558d15fac9b0ddfed8c465bc7359d7dce0';
const TYDRO_REPAY_EVENT_TOPIC = '0xa534c8dbe71f871f9f3530e97a74601fea17b426cae02e1c5aee42c96c784051';

// Known tokens for price calculation
const TYDRO_KNOWN_TOKENS: Record<string, { symbol: string; decimals: number; usdPegged?: boolean; ethPegged?: boolean; btcPegged?: boolean }> = {
  '0xe343167631d89b6ffc58b88d6b7fb0228795491d': { symbol: 'USDG', decimals: 18, usdPegged: true },
  '0x0200c29006150606b650577bbe7b6248f58470c1': { symbol: 'USDT', decimals: 6, usdPegged: true },
  '0x2d270e6886d130d724215a266106e6832161eaed': { symbol: 'USDC', decimals: 6, usdPegged: true },
  '0xfc421ad3c883bf9e7c4f42de845c4e4405799e73': { symbol: 'GHO', decimals: 18, usdPegged: true },
  '0xeb466342c4d449bc9f53a865d5cb90586f405215': { symbol: 'axlUSDC', decimals: 6, usdPegged: true },
  '0x4200000000000000000000000000000000000006': { symbol: 'WETH', decimals: 18, ethPegged: true },
  '0x2416092f143378750bb29b79ed961ab195cceea5': { symbol: 'ezETH', decimals: 18, ethPegged: true },
  '0xa3d68b74bf0528fdd07263c60d6488749044914b': { symbol: 'weETH', decimals: 18, ethPegged: true },
  '0x9f0a74a92287e323eb95c1cd9ecdbeb0e397cae4': { symbol: 'wrsETH', decimals: 18, ethPegged: true },
  '0x73e0c0d45e048d25fc26fa3159b0aa04bfa4db98': { symbol: 'kBTC', decimals: 8, btcPegged: true },
};

// BTC price cache
let tydroBtcPriceCache: { price: number; timestamp: number } | null = null;
const TYDRO_BTC_PRICE_CACHE_TTL = 5 * 60 * 1000;

async function getTydroBtcPrice(): Promise<number> {
  if (tydroBtcPriceCache && Date.now() - tydroBtcPriceCache.timestamp < TYDRO_BTC_PRICE_CACHE_TTL) {
    return tydroBtcPriceCache.price;
  }
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
    if (response.ok) {
      const data = await response.json() as { bitcoin?: { usd?: number } };
      const price = data.bitcoin?.usd || 95000;
      tydroBtcPriceCache = { price, timestamp: Date.now() };
      return price;
    }
  } catch (error) {
    console.error('Failed to fetch BTC price:', error);
  }
  return tydroBtcPriceCache?.price || 95000;
}

interface TydroLogEntry {
  event?: string;
  data?: string;
  topics?: string[];
  address?: { id?: string };
}

interface TydroEnrichedTx {
  tx_hash: string;
  method_id: string;
  value: string | null;
  logs: TydroLogEntry[] | string | null;
}

export interface TydroResponse {
  currentSupplyUsd: number;
  currentSupplyEth: number;
  totalDepositedUsd: number;
  totalDepositedEth: number;
  totalWithdrawnUsd: number;
  totalWithdrawnEth: number;
  depositCount: number;
  withdrawCount: number;
  currentBorrowUsd: number;
  currentBorrowEth: number;
  totalBorrowedUsd: number;
  totalBorrowedEth: number;
  totalRepaidUsd: number;
  totalRepaidEth: number;
  borrowCount: number;
  repayCount: number;
}

// Parse amount from event log data field
function parseTydroAmountFromEventData(
  data: string,
  reserve: string,
  eventType: 'supply' | 'withdraw' | 'borrow' | 'repay'
): { amount: bigint; decimals: number } | null {
  try {
    if (!data || data.length < 66) return null;

    const cleanData = data.startsWith('0x') ? data.slice(2) : data;
    let amountHex: string;

    if (eventType === 'supply') {
      if (cleanData.length >= 128) {
        amountHex = cleanData.slice(64, 128);
      } else {
        amountHex = cleanData.slice(-64);
      }
    } else if (eventType === 'withdraw') {
      if (cleanData.length >= 192) {
        amountHex = cleanData.slice(128, 192);
      } else {
        amountHex = cleanData.slice(-64);
      }
    } else if (eventType === 'borrow') {
      if (cleanData.length >= 128) {
        amountHex = cleanData.slice(64, 128);
      } else {
        amountHex = cleanData.slice(-64);
      }
    } else if (eventType === 'repay') {
      if (cleanData.length >= 64) {
        amountHex = cleanData.slice(0, 64);
      } else {
        amountHex = cleanData;
      }
    } else {
      amountHex = cleanData.slice(-64);
    }

    const amount = BigInt('0x' + amountHex);
    const token = TYDRO_KNOWN_TOKENS[reserve.toLowerCase()];
    const decimals = token?.decimals || 18;

    return { amount, decimals };
  } catch {
    return null;
  }
}

// Extract reserve address from event topics
function getTydroReserveFromTopics(topics: string[]): string | null {
  if (topics && topics.length > 1) {
    const reserveTopic = topics[1];
    return '0x' + reserveTopic.slice(-40).toLowerCase();
  }
  return null;
}

// Get token price in USD
async function getTydroTokenPriceUsd(tokenAddress: string, ethPrice: number): Promise<number> {
  const addr = tokenAddress.toLowerCase();
  const token = TYDRO_KNOWN_TOKENS[addr];
  if (token?.usdPegged) return 1;
  if (token?.ethPegged) return ethPrice;
  if (token?.btcPegged) return await getTydroBtcPrice();
  return ethPrice;
}

// Parse a transaction's logs to extract Tydro action and amount
async function parseTydroTransaction(
  tx: TydroEnrichedTx,
  ethPrice: number
): Promise<{ action: 'supply' | 'withdraw' | 'borrow' | 'repay'; amountUsd: number; amountEth: number; reserve: string } | null> {
  const methodId = tx.method_id?.toLowerCase();

  let action: 'supply' | 'withdraw' | 'borrow' | 'repay';
  let eventTopic: string;

  if (TYDRO_SUPPLY_METHODS.includes(methodId)) {
    action = 'supply';
    eventTopic = TYDRO_SUPPLY_EVENT_TOPIC;
  } else if (TYDRO_WITHDRAW_METHODS.includes(methodId)) {
    action = 'withdraw';
    eventTopic = TYDRO_WITHDRAW_EVENT_TOPIC;
  } else if (TYDRO_BORROW_METHODS.includes(methodId)) {
    action = 'borrow';
    eventTopic = TYDRO_BORROW_EVENT_TOPIC;
  } else if (TYDRO_REPAY_METHODS.includes(methodId)) {
    action = 'repay';
    eventTopic = TYDRO_REPAY_EVENT_TOPIC;
  } else {
    return null;
  }

  // For ETH deposit (depositETH), use tx value directly
  if (methodId === '0x474cf53d') {
    const valueWei = BigInt(tx.value || '0');
    const amountEth = Number(valueWei) / 1e18;
    const amountUsd = amountEth * ethPrice;
    return { action, amountUsd, amountEth, reserve: '0x4200000000000000000000000000000000000006' };
  }

  // For ETH repay (repayETH), use tx value directly
  if (methodId === '0xbcc3c255') {
    const valueWei = BigInt(tx.value || '0');
    const amountEth = Number(valueWei) / 1e18;
    const amountUsd = amountEth * ethPrice;

    // If value is 0, try to get amount from Repay event in logs
    if (amountEth === 0 && tx.logs) {
      const logs: TydroLogEntry[] = typeof tx.logs === 'string' ? JSON.parse(tx.logs) : tx.logs;
      if (Array.isArray(logs)) {
        for (const log of logs) {
          const topics = log.topics;
          if (!topics || topics.length === 0) continue;

          if (topics[0]?.toLowerCase() === TYDRO_REPAY_EVENT_TOPIC.toLowerCase()) {
            const reserve = getTydroReserveFromTopics(topics);
            if (!reserve) continue;

            const parsed = parseTydroAmountFromEventData(log.data || '', reserve, 'repay');
            if (!parsed) continue;

            const token = TYDRO_KNOWN_TOKENS[reserve];
            const tokenPrice = await getTydroTokenPriceUsd(reserve, ethPrice);
            const amount = Number(parsed.amount) / Math.pow(10, parsed.decimals);
            const amountUsdFromLog = amount * tokenPrice;
            const amountEthFromLog = token?.ethPegged ? amount : 0;

            return { action, amountUsd: amountUsdFromLog, amountEth: amountEthFromLog, reserve };
          }
        }
      }
    }

    return { action, amountUsd, amountEth, reserve: '0x4200000000000000000000000000000000000006' };
  }

  // Parse logs to find the relevant event
  if (!tx.logs) return null;
  const logs: TydroLogEntry[] = typeof tx.logs === 'string' ? JSON.parse(tx.logs) : tx.logs;
  if (!Array.isArray(logs)) return null;

  for (const log of logs) {
    const topics = log.topics;
    if (!topics || topics.length === 0) continue;

    if (topics[0]?.toLowerCase() === eventTopic.toLowerCase()) {
      const reserve = getTydroReserveFromTopics(topics);
      if (!reserve) continue;

      const parsed = parseTydroAmountFromEventData(log.data || '', reserve, action);
      if (!parsed) continue;

      const token = TYDRO_KNOWN_TOKENS[reserve];
      const tokenPrice = await getTydroTokenPriceUsd(reserve, ethPrice);
      const amount = Number(parsed.amount) / Math.pow(10, parsed.decimals);
      const amountUsd = amount * tokenPrice;
      const amountEth = token?.ethPegged ? amount : 0;

      return { action, amountUsd, amountEth, reserve };
    }
  }

  // Fallback: try to find event by name in logs
  for (const log of logs) {
    const eventName = log.event?.toLowerCase() || '';

    if (action === 'supply' && eventName.includes('supply')) {
      const reserve = getTydroReserveFromTopics(log.topics || []);
      if (!reserve) continue;

      const parsed = parseTydroAmountFromEventData(log.data || '', reserve, 'supply');
      if (!parsed) continue;

      const token = TYDRO_KNOWN_TOKENS[reserve];
      const tokenPrice = await getTydroTokenPriceUsd(reserve, ethPrice);
      const amount = Number(parsed.amount) / Math.pow(10, parsed.decimals);
      const amountUsd = amount * tokenPrice;
      const amountEth = token?.ethPegged ? amount : 0;

      return { action, amountUsd, amountEth, reserve };
    }

    if (action === 'withdraw' && eventName.includes('withdraw')) {
      const reserve = getTydroReserveFromTopics(log.topics || []);
      if (!reserve) continue;

      const parsed = parseTydroAmountFromEventData(log.data || '', reserve, 'withdraw');
      if (!parsed) continue;

      const token = TYDRO_KNOWN_TOKENS[reserve];
      const tokenPrice = await getTydroTokenPriceUsd(reserve, ethPrice);
      const amount = Number(parsed.amount) / Math.pow(10, parsed.decimals);
      const amountUsd = amount * tokenPrice;
      const amountEth = token?.ethPegged ? amount : 0;

      return { action, amountUsd, amountEth, reserve };
    }

    if (action === 'borrow' && eventName.includes('borrow')) {
      const reserve = getTydroReserveFromTopics(log.topics || []);
      if (!reserve) continue;

      const parsed = parseTydroAmountFromEventData(log.data || '', reserve, 'borrow');
      if (!parsed) continue;

      const token = TYDRO_KNOWN_TOKENS[reserve];
      const tokenPrice = await getTydroTokenPriceUsd(reserve, ethPrice);
      const amount = Number(parsed.amount) / Math.pow(10, parsed.decimals);
      const amountUsd = amount * tokenPrice;
      const amountEth = token?.ethPegged ? amount : 0;

      return { action, amountUsd, amountEth, reserve };
    }

    if (action === 'repay' && eventName.includes('repay')) {
      const reserve = getTydroReserveFromTopics(log.topics || []);
      if (!reserve) continue;

      const parsed = parseTydroAmountFromEventData(log.data || '', reserve, 'repay');
      if (!parsed) continue;

      const token = TYDRO_KNOWN_TOKENS[reserve];
      const tokenPrice = await getTydroTokenPriceUsd(reserve, ethPrice);
      const amount = Number(parsed.amount) / Math.pow(10, parsed.decimals);
      const amountUsd = amount * tokenPrice;
      const amountEth = token?.ethPegged ? amount : 0;

      return { action, amountUsd, amountEth, reserve };
    }
  }

  return null;
}

// GET /api/wallet/:address/tydro
router.get('/:address/tydro', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    if (!isValidAddress(address)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    const walletAddress = address.toLowerCase();

    const cacheKey = `wallet:tydro:${walletAddress}`;
    const cached = responseCache.get<TydroResponse>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Get ETH price
    let ethPrice = 3500;
    try {
      const priceResult = await pool.query(
        `SELECT price_usd FROM eth_prices ORDER BY timestamp DESC LIMIT 1`
      );
      ethPrice = priceResult.rows[0]?.price_usd || 3500;
    } catch {
      // Use fallback price
    }

    const allMethods = [...TYDRO_SUPPLY_METHODS, ...TYDRO_WITHDRAW_METHODS, ...TYDRO_BORROW_METHODS, ...TYDRO_REPAY_METHODS];

    // Query from transaction_enrichment table
    const result = await pool.query(`
      SELECT
        tx_hash,
        method_id,
        value,
        logs
      FROM transaction_enrichment
      WHERE LOWER(wallet_address) = LOWER($1)
        AND LOWER(contract_address) = ANY($2)
        AND method_id = ANY($3)
      ORDER BY created_at ASC
    `, [walletAddress, TYDRO_CONTRACTS, allMethods]);

    const txs: TydroEnrichedTx[] = result.rows;

    if (txs.length === 0) {
      const emptyResponse: TydroResponse = {
        currentSupplyUsd: 0,
        currentSupplyEth: 0,
        totalDepositedUsd: 0,
        totalDepositedEth: 0,
        totalWithdrawnUsd: 0,
        totalWithdrawnEth: 0,
        depositCount: 0,
        withdrawCount: 0,
        currentBorrowUsd: 0,
        currentBorrowEth: 0,
        totalBorrowedUsd: 0,
        totalBorrowedEth: 0,
        totalRepaidUsd: 0,
        totalRepaidEth: 0,
        borrowCount: 0,
        repayCount: 0,
      };
      return res.json(emptyResponse);
    }

    // Track per-reserve balances for current position calculation
    const supplyBalances: Map<string, number> = new Map();
    const borrowBalances: Map<string, number> = new Map();

    // Aggregate metrics
    let totalDepositedUsd = 0, totalDepositedEth = 0;
    let totalWithdrawnUsd = 0, totalWithdrawnEth = 0;
    let totalBorrowedUsd = 0, totalBorrowedEth = 0;
    let totalRepaidUsd = 0, totalRepaidEth = 0;
    let depositCount = 0, withdrawCount = 0, borrowCount = 0, repayCount = 0;

    for (const tx of txs) {
      const parsed = await parseTydroTransaction(tx, ethPrice);
      if (!parsed) continue;

      const { action, amountUsd, amountEth, reserve } = parsed;

      switch (action) {
        case 'supply':
          depositCount++;
          totalDepositedUsd += amountUsd;
          totalDepositedEth += amountEth;
          const currentSupplyBalance = supplyBalances.get(reserve) || 0;
          supplyBalances.set(reserve, Math.round((currentSupplyBalance + amountUsd) * 100) / 100);
          break;
        case 'withdraw':
          withdrawCount++;
          totalWithdrawnUsd += amountUsd;
          totalWithdrawnEth += amountEth;
          const currentSupplyBalanceWithdraw = supplyBalances.get(reserve) || 0;
          supplyBalances.set(reserve, Math.max(0, Math.round((currentSupplyBalanceWithdraw - amountUsd) * 100) / 100));
          break;
        case 'borrow':
          borrowCount++;
          totalBorrowedUsd += amountUsd;
          totalBorrowedEth += amountEth;
          const currentBorrowBalance = borrowBalances.get(reserve) || 0;
          borrowBalances.set(reserve, Math.round((currentBorrowBalance + amountUsd) * 100) / 100);
          break;
        case 'repay':
          repayCount++;
          totalRepaidUsd += amountUsd;
          totalRepaidEth += amountEth;
          const currentBorrowBalanceRepay = borrowBalances.get(reserve) || 0;
          borrowBalances.set(reserve, Math.max(0, Math.round((currentBorrowBalanceRepay - amountUsd) * 100) / 100));
          break;
      }
    }

    // Calculate current positions
    let currentSupplyUsd = Math.max(0, totalDepositedUsd - totalWithdrawnUsd);
    let currentSupplyEth = Math.max(0, totalDepositedEth - totalWithdrawnEth);
    let currentBorrowUsd = Math.max(0, totalBorrowedUsd - totalRepaidUsd);
    let currentBorrowEth = Math.max(0, totalBorrowedEth - totalRepaidEth);

    // Round to avoid floating point precision issues
    currentSupplyUsd = Math.round(currentSupplyUsd * 100) / 100;
    currentSupplyEth = Math.round(currentSupplyEth * 10000) / 10000;
    currentBorrowUsd = Math.round(currentBorrowUsd * 100) / 100;
    currentBorrowEth = Math.round(currentBorrowEth * 10000) / 10000;

    const response: TydroResponse = {
      currentSupplyUsd: Math.round(currentSupplyUsd * 100) / 100,
      currentSupplyEth: Math.round(currentSupplyEth * 10000) / 10000,
      totalDepositedUsd: Math.round(totalDepositedUsd * 100) / 100,
      totalDepositedEth: Math.round(totalDepositedEth * 10000) / 10000,
      totalWithdrawnUsd: Math.round(totalWithdrawnUsd * 100) / 100,
      totalWithdrawnEth: Math.round(totalWithdrawnEth * 10000) / 10000,
      depositCount,
      withdrawCount,
      currentBorrowUsd: Math.round(currentBorrowUsd * 100) / 100,
      currentBorrowEth: Math.round(currentBorrowEth * 10000) / 10000,
      totalBorrowedUsd: Math.round(totalBorrowedUsd * 100) / 100,
      totalBorrowedEth: Math.round(totalBorrowedEth * 10000) / 10000,
      totalRepaidUsd: Math.round(totalRepaidUsd * 100) / 100,
      totalRepaidEth: Math.round(totalRepaidEth * 10000) / 10000,
      borrowCount,
      repayCount,
    };

    responseCache.set(cacheKey, response);

    return res.json(response);
  } catch (error) {
    console.error('Error fetching Tydro data:', error);
    res.status(500).json({ error: 'Failed to fetch Tydro data' });
  }
});


// ============================================
// NFT2Me Route
// ============================================

// NFT2Me contract address
const NFT2ME_CONTRACT = '0x00000000001594c61dd8a6804da9ab58ed2a59e3';

export interface Nft2meResponse {
  collectionsCreated: number;
  nftsMinted: number;
  totalTransactions: number;
}

// GET /api/wallet/:address/nft2me
router.get('/:address/nft2me', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    if (!isValidAddress(address)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    const walletAddress = address.toLowerCase();

    const cacheKey = `wallet:nft2me:${walletAddress}`;
    const cached = responseCache.get<Nft2meResponse>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Query NFT2Me transactions
    const result = await pool.query(`
      SELECT 
        COUNT(CASE WHEN function_name IN ('createCollection', 'deployCollection') THEN 1 END) as collections_created,
        COUNT(CASE WHEN function_name IN ('mint', 'mintTo', 'safeMint') THEN 1 END) as nfts_minted,
        COUNT(*) as total_count
      FROM transaction_details
      WHERE wallet_address = $1
        AND contract_address = $2
        AND status = 1
    `, [walletAddress, NFT2ME_CONTRACT]);

    const row = result.rows[0];

    const response: Nft2meResponse = {
      collectionsCreated: parseInt(row?.collections_created || '0'),
      nftsMinted: parseInt(row?.nfts_minted || '0'),
      totalTransactions: parseInt(row?.total_count || '0'),
    };

    responseCache.set(cacheKey, response);

    return res.json(response);
  } catch (error) {
    console.error('Error fetching NFT2Me data:', error);
    res.status(500).json({ error: 'Failed to fetch NFT2Me data' });
  }
});


export default router;


// ============================================
// Bridge Volume Route
// ============================================

// Relay wallet handles both "Relay" and "Ink Official" based on method selectors (Bridge IN)
const RELAY_WALLET = '0xf70da97812cb96acdf810712aa562db8dfa3dbef';

// Relay deposit contract for Bridge OUT (depositNative) - shared by Relay and Ink Official
const RELAY_DEPOSIT_CONTRACT = '0x4cd00e387622c35bddb9b4c962c136462338bc31';

// Method selectors for Ink Official bridge IN
const INK_OFFICIAL_METHODS = ['0x0c6d9703', '0x5819bf3d'];

// OFT Adapter contract address for Native Bridge (USDT0) - Bridge OUT
const OFT_ADAPTER_ADDRESS = '0x1cb6de532588fca4a21b7209de7c456af8434a65';

// LayerZero Executor contract for Native Bridge (USDT0) - Bridge IN
const LZ_EXECUTOR_ADDRESS = '0xfebcf17b11376c724ab5a5229803c6e838b6eae5';

// Bungee contracts
const BUNGEE_SOCKET_GATEWAY = '0x3a23f943181408eac424116af7b7790c94cb97a5';
const BUNGEE_FULFILLMENT_CONTRACT = '0x26d8da52e56de71194950689ccf74cd309761324';
const BUNGEE_REQUEST_CONTRACT = '0xe18dfefce7a5d18d39ce6fc925f102286fa96fdc';

// Event signatures
const OFT_SENT_SIGNATURE = '0x85496b760a4b7f8d66384b9df21b381f5d1b1e79f229a47aaf4c232edc2fe59a';
const OFT_RECEIVED_SIGNATURE = '0xefed6d3500546b29533b128a29e3a94d70788727f0507505ac12eaf2e578fd9c';

const USDT0_DECIMALS = 6;

// All bridge platforms configuration
const ALL_BRIDGE_PLATFORMS: Record<string, { logo: string; url: string }> = {
  'Native Bridge (USDT0)': {
    logo: 'https://pbs.twimg.com/profile_images/1879546764971188224/SQISVYwX_400x400.jpg',
    url: 'https://usdt0.to',
  },
  'Ink Official': {
    logo: 'https://inkonchain.com/favicon.ico',
    url: 'https://inkonchain.com/bridge',
  },
  'Relay': {
    logo: 'https://relay.link/favicon.ico',
    url: 'https://relay.link',
  },
  'Bungee': {
    logo: 'https://www.bungee.exchange/favicon.ico',
    url: 'https://www.bungee.exchange',
  },
};

export interface BridgeVolumeResponse {
  totalEth: number;
  totalUsd: number;
  txCount: number;
  bridgedInUsd: number;
  bridgedInCount: number;
  bridgedOutUsd: number;
  bridgedOutCount: number;
  byPlatform: Array<{
    platform: string;
    ethValue: number;
    usdValue: number;
    txCount: number;
    logo: string;
    url: string;
    bridgedInUsd?: number;
    bridgedInCount?: number;
    bridgedOutUsd?: number;
    bridgedOutCount?: number;
  }>;
}

interface OftEventLog {
  index: number;
  address: { id: string };
  topics: string[];
  data: string;
  event?: string;
}

interface Operation {
  to: { id: string };
  from: { id: string };
  value: string;
  type: string;
  status?: boolean;
}

function parseOftSentAmount(data: string): bigint {
  const cleanData = data.startsWith('0x') ? data.slice(2) : data;
  const amountHex = cleanData.slice(64, 128);
  return BigInt('0x' + amountHex);
}

function parseOftReceivedAmount(data: string): bigint {
  const cleanData = data.startsWith('0x') ? data.slice(2) : data;
  const amountHex = cleanData.slice(64, 128);
  return BigInt('0x' + amountHex);
}

function extractAddressFromTopic(topic: string): string {
  const cleanTopic = topic.startsWith('0x') ? topic.slice(2) : topic;
  return '0x' + cleanTopic.slice(-40).toLowerCase();
}


// GET /api/wallet/:address/bridge
router.get('/:address/bridge', async (req: Request, res: Response) => {
  const requestStart = Date.now();
  try {
    const { address } = req.params;

    if (!isValidAddress(address)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    const walletAddress = address.toLowerCase();

    const cacheKey = `wallet:bridge:${walletAddress}`;
    const cached = responseCache.get<BridgeVolumeResponse>(cacheKey);
    if (cached) {
      console.log(`[Bridge ${walletAddress}] Cache hit - returning cached result`);
      return res.json(cached);
    }

    console.log(`[Bridge ${walletAddress}] Starting bridge volume calculation...`);

    const platformData: Record<string, {
      ethValue: number;
      usdValue: number;
      txCount: number;
      bridgedInUsd?: number;
      bridgedInCount?: number;
      bridgedOutUsd?: number;
      bridgedOutCount?: number;
    }> = {
      'Native Bridge (USDT0)': { ethValue: 0, usdValue: 0, txCount: 0 },
      'Ink Official': { ethValue: 0, usdValue: 0, txCount: 0 },
      'Relay': { ethValue: 0, usdValue: 0, txCount: 0 },
      'Bungee': { ethValue: 0, usdValue: 0, txCount: 0 },
    };

    let totalEth = 0;
    let totalTxCount = 0;
    let bridgedInUsd = 0;
    let bridgedInCount = 0;
    let bridgedOutUsd = 0;
    let bridgedOutCount = 0;

    // Get ETH price
    let ethPrice = 3500;
    try {
      const priceStart = Date.now();
      const priceResult = await pool.query(
        `SELECT price_usd FROM eth_prices ORDER BY timestamp DESC LIMIT 1`
      );
      console.log(`[Bridge ${walletAddress}] ETH price query: ${Date.now() - priceStart}ms`);
      ethPrice = priceResult.rows[0]?.price_usd || 3500;
    } catch {
      // Use fallback price
    }

    // 1. Query Relay/Ink Official bridge IN transactions
    try {
      const relayInStart = Date.now();
      const relayResult = await pool.query(
        `SELECT 
           tx_hash, method_id, operations, value,
           COALESCE(eth_value_decimal, 0) as eth_value_decimal,
           COALESCE(eth_price_usd, $2) as eth_price_usd
         FROM transaction_enrichment
         WHERE LOWER(contract_address) = LOWER($1)
           AND related_wallets @> ARRAY[$3]::text[]`,
        [RELAY_WALLET, ethPrice, walletAddress]
      );
      console.log(`[Bridge ${walletAddress}] Relay/Ink IN query: ${Date.now() - relayInStart}ms (${relayResult.rows.length} rows)`);

      for (const row of relayResult.rows) {
        let operations: Operation[] = [];
        try {
          operations = typeof row.operations === 'string' ? JSON.parse(row.operations) : row.operations || [];
        } catch {
          continue;
        }

        const userTransfer = operations.find(op => op.to?.id?.toLowerCase() === walletAddress);
        if (!userTransfer) continue;

        let ethValue = 0;
        if (userTransfer.value) {
          ethValue = Number(BigInt(userTransfer.value)) / 1e18;
        }
        if (ethValue === 0) ethValue = parseFloat(row.eth_value_decimal || '0');
        if (ethValue === 0 && row.value) ethValue = Number(BigInt(row.value)) / 1e18;

        const txEthPrice = parseFloat(row.eth_price_usd || String(ethPrice));
        const usdValue = ethValue * txEthPrice;

        const methodId = row.method_id?.toLowerCase();
        const platform = INK_OFFICIAL_METHODS.includes(methodId) ? 'Ink Official' : 'Relay';

        platformData[platform].ethValue += ethValue;
        platformData[platform].usdValue += usdValue;
        platformData[platform].txCount += 1;
        platformData[platform].bridgedInUsd = (platformData[platform].bridgedInUsd || 0) + usdValue;
        platformData[platform].bridgedInCount = (platformData[platform].bridgedInCount || 0) + 1;

        totalEth += ethValue;
        totalTxCount += 1;
        bridgedInUsd += usdValue;
        bridgedInCount += 1;
      }
    } catch (dbError: unknown) {
      console.error('Error querying Relay/Ink Official:', dbError instanceof Error ? dbError.message : dbError);
    }


    // 1b. Query Relay/Ink Official bridge OUT transactions (depositNative)
    try {
      const relayOutStart = Date.now();
      const relayOutResult = await pool.query(
        `SELECT tx_hash, value, method_id,
           COALESCE(eth_value_decimal, 0) as eth_value_decimal,
           COALESCE(eth_price_usd, $2) as eth_price_usd
         FROM transaction_enrichment
         WHERE LOWER(contract_address) = LOWER($1)
           AND LOWER(wallet_address) = LOWER($3)`,
        [RELAY_DEPOSIT_CONTRACT, ethPrice, walletAddress]
      );
      console.log(`[Bridge ${walletAddress}] Relay/Ink OUT query: ${Date.now() - relayOutStart}ms (${relayOutResult.rows.length} rows)`);

      let sharedBridgeOutEth = 0;
      let sharedBridgeOutUsd = 0;
      let sharedBridgeOutCount = 0;

      for (const row of relayOutResult.rows) {
        let ethValue = parseFloat(row.eth_value_decimal || '0');
        if (ethValue === 0 && row.value) {
          ethValue = Number(BigInt(row.value)) / 1e18;
        }

        const txEthPrice = parseFloat(row.eth_price_usd || String(ethPrice));
        const usdValue = ethValue * txEthPrice;

        sharedBridgeOutEth += ethValue;
        sharedBridgeOutUsd += usdValue;
        sharedBridgeOutCount += 1;
      }

      if (sharedBridgeOutCount > 0) {
        platformData['Ink Official'].ethValue += sharedBridgeOutEth;
        platformData['Ink Official'].usdValue += sharedBridgeOutUsd;
        platformData['Ink Official'].txCount += sharedBridgeOutCount;
        platformData['Ink Official'].bridgedOutUsd = (platformData['Ink Official'].bridgedOutUsd || 0) + sharedBridgeOutUsd;
        platformData['Ink Official'].bridgedOutCount = (platformData['Ink Official'].bridgedOutCount || 0) + sharedBridgeOutCount;

        platformData['Relay'].bridgedOutUsd = (platformData['Relay'].bridgedOutUsd || 0) + sharedBridgeOutUsd;
        platformData['Relay'].bridgedOutCount = (platformData['Relay'].bridgedOutCount || 0) + sharedBridgeOutCount;

        totalEth += sharedBridgeOutEth;
        totalTxCount += sharedBridgeOutCount;
        bridgedOutUsd += sharedBridgeOutUsd;
        bridgedOutCount += sharedBridgeOutCount;
      }
    } catch (dbError: unknown) {
      console.error('Error querying Relay/Ink Official OUT:', dbError instanceof Error ? dbError.message : dbError);
    }

    // 2a. Query Native Bridge (USDT0) IN transactions
    try {
      const nativeBridgeInStart = Date.now();
      const nativeBridgeInResult = await pool.query(
        `SELECT tx_hash, logs
         FROM transaction_enrichment
         WHERE LOWER(contract_address) = LOWER($1)
           AND related_wallets @> ARRAY[$2]::text[]`,
        [LZ_EXECUTOR_ADDRESS, walletAddress]
      );
      console.log(`[Bridge ${walletAddress}] Native Bridge IN query: ${Date.now() - nativeBridgeInStart}ms (${nativeBridgeInResult.rows.length} rows)`);

      for (const row of nativeBridgeInResult.rows) {
        const logs: OftEventLog[] = typeof row.logs === 'string' ? JSON.parse(row.logs) : row.logs;
        if (!Array.isArray(logs)) continue;

        for (const log of logs) {
          const logAddress = (log.address?.id || '').toLowerCase();
          const topic0 = log.topics?.[0]?.toLowerCase();
          const topic2 = log.topics?.[2];

          if (logAddress !== OFT_ADAPTER_ADDRESS.toLowerCase()) continue;
          if (topic0 !== OFT_RECEIVED_SIGNATURE.toLowerCase()) continue;
          if (!topic2) continue;

          const eventWallet = extractAddressFromTopic(topic2);
          if (eventWallet !== walletAddress) continue;

          const amountRaw = parseOftReceivedAmount(log.data);
          const amountUsd = Number(amountRaw) / Math.pow(10, USDT0_DECIMALS);

          platformData['Native Bridge (USDT0)'].usdValue += amountUsd;
          platformData['Native Bridge (USDT0)'].txCount += 1;
          platformData['Native Bridge (USDT0)'].bridgedInUsd = (platformData['Native Bridge (USDT0)'].bridgedInUsd || 0) + amountUsd;
          platformData['Native Bridge (USDT0)'].bridgedInCount = (platformData['Native Bridge (USDT0)'].bridgedInCount || 0) + 1;

          totalTxCount += 1;
          bridgedInUsd += amountUsd;
          bridgedInCount += 1;
        }
      }
    } catch (dbError: unknown) {
      console.error('Error querying Native Bridge IN:', dbError instanceof Error ? dbError.message : dbError);
    }


    // 2b. Query Native Bridge (USDT0) OUT transactions
    try {
      const bridgeOutStart = Date.now();
      const bridgeOutResult = await pool.query(
        `SELECT tx_hash, logs
         FROM transaction_enrichment
         WHERE LOWER(contract_address) = LOWER($1)
           AND LOWER(wallet_address) = LOWER($2)
           AND logs IS NOT NULL`,
        [OFT_ADAPTER_ADDRESS, walletAddress]
      );
      console.log(`[Bridge ${walletAddress}] Native Bridge OUT query: ${Date.now() - bridgeOutStart}ms (${bridgeOutResult.rows.length} rows)`);

      for (const row of bridgeOutResult.rows) {
        const logs: OftEventLog[] = typeof row.logs === 'string' ? JSON.parse(row.logs) : row.logs;
        if (!Array.isArray(logs)) continue;

        for (const log of logs) {
          const logAddress = (log.address?.id || '').toLowerCase();
          const topic0 = log.topics?.[0]?.toLowerCase();
          const topic2 = log.topics?.[2];

          if (logAddress !== OFT_ADAPTER_ADDRESS.toLowerCase()) continue;
          if (topic0 !== OFT_SENT_SIGNATURE.toLowerCase()) continue;
          if (!topic2) continue;

          const eventWallet = extractAddressFromTopic(topic2);
          if (eventWallet !== walletAddress) continue;

          const amountRaw = parseOftSentAmount(log.data);
          const amountUsd = Number(amountRaw) / Math.pow(10, USDT0_DECIMALS);

          platformData['Native Bridge (USDT0)'].usdValue += amountUsd;
          platformData['Native Bridge (USDT0)'].txCount += 1;
          platformData['Native Bridge (USDT0)'].bridgedOutUsd = (platformData['Native Bridge (USDT0)'].bridgedOutUsd || 0) + amountUsd;
          platformData['Native Bridge (USDT0)'].bridgedOutCount = (platformData['Native Bridge (USDT0)'].bridgedOutCount || 0) + 1;

          totalTxCount += 1;
          bridgedOutUsd += amountUsd;
          bridgedOutCount += 1;
        }
      }
    } catch (dbError: unknown) {
      console.error('Error querying Native Bridge OUT:', dbError instanceof Error ? dbError.message : dbError);
    }

    // 3. Query Bungee bridge transactions
    try {
      // 3a. Bungee Bridge IN (PerformFulfilment)
      const bungeeInStart = Date.now();
      const bungeeInResult = await pool.query(
        `SELECT tx_hash, operations, value,
           COALESCE(eth_value_decimal, 0) as eth_value_decimal,
           COALESCE(eth_price_usd, $2) as eth_price_usd
         FROM transaction_enrichment
         WHERE LOWER(contract_address) = LOWER($1)
           AND related_wallets @> ARRAY[$3]::text[]`,
        [BUNGEE_FULFILLMENT_CONTRACT, ethPrice, walletAddress]
      );
      console.log(`[Bridge ${walletAddress}] Bungee IN query: ${Date.now() - bungeeInStart}ms (${bungeeInResult.rows.length} rows)`);

      for (const row of bungeeInResult.rows) {
        let operations: Operation[] = [];
        try {
          operations = typeof row.operations === 'string' ? JSON.parse(row.operations) : row.operations || [];
        } catch {
          continue;
        }

        const userTransfer = operations.find(op => op.to?.id?.toLowerCase() === walletAddress);
        if (!userTransfer) continue;

        let ethValue = 0;
        if (userTransfer.value) {
          ethValue = Number(BigInt(userTransfer.value)) / 1e18;
        }
        if (ethValue === 0) ethValue = parseFloat(row.eth_value_decimal || '0');

        const txEthPrice = parseFloat(row.eth_price_usd || String(ethPrice));
        const usdValue = ethValue * txEthPrice;

        // Sanity check: skip unreasonably large values
        if (usdValue > 1_000_000) continue;

        platformData['Bungee'].ethValue += ethValue;
        platformData['Bungee'].usdValue += usdValue;
        platformData['Bungee'].txCount += 1;
        platformData['Bungee'].bridgedInUsd = (platformData['Bungee'].bridgedInUsd || 0) + usdValue;
        platformData['Bungee'].bridgedInCount = (platformData['Bungee'].bridgedInCount || 0) + 1;

        totalEth += ethValue;
        totalTxCount += 1;
        bridgedInUsd += usdValue;
        bridgedInCount += 1;
      }


      // 3b. Bungee Bridge OUT (CreateRequest)
      const bungeeOutStart = Date.now();
      const bungeeOutResult = await pool.query(
        `SELECT tx_hash, value,
           COALESCE(eth_value_decimal, 0) as eth_value_decimal,
           COALESCE(eth_price_usd, $2) as eth_price_usd
         FROM transaction_enrichment
         WHERE LOWER(contract_address) = LOWER($1)
           AND LOWER(wallet_address) = LOWER($3)`,
        [BUNGEE_REQUEST_CONTRACT, ethPrice, walletAddress]
      );
      console.log(`[Bridge ${walletAddress}] Bungee OUT query: ${Date.now() - bungeeOutStart}ms (${bungeeOutResult.rows.length} rows)`);

      for (const row of bungeeOutResult.rows) {
        let ethValue = parseFloat(row.eth_value_decimal || '0');
        if (ethValue === 0 && row.value) {
          ethValue = Number(BigInt(row.value)) / 1e18;
        }

        const txEthPrice = parseFloat(row.eth_price_usd || String(ethPrice));
        const usdValue = ethValue * txEthPrice;

        // Sanity check: skip unreasonably large values
        if (usdValue > 1_000_000) continue;

        platformData['Bungee'].ethValue += ethValue;
        platformData['Bungee'].usdValue += usdValue;
        platformData['Bungee'].txCount += 1;
        platformData['Bungee'].bridgedOutUsd = (platformData['Bungee'].bridgedOutUsd || 0) + usdValue;
        platformData['Bungee'].bridgedOutCount = (platformData['Bungee'].bridgedOutCount || 0) + 1;

        totalEth += ethValue;
        totalTxCount += 1;
        bridgedOutUsd += usdValue;
        bridgedOutCount += 1;
      }

      // 3c. Legacy Socket Gateway transactions - skip failed txs, use sanity checks
      const bungeeGatewayStart = Date.now();
      const bungeeGatewayResult = await pool.query(
        `SELECT tx_hash, operations, eth_value_decimal, total_usd_volume, value
         FROM transaction_enrichment
         WHERE LOWER(contract_address) = LOWER($1)
           AND LOWER(wallet_address) = LOWER($2)`,
        [BUNGEE_SOCKET_GATEWAY, walletAddress]
      );
      console.log(`[Bridge ${walletAddress}] Bungee Gateway query: ${Date.now() - bungeeGatewayStart}ms (${bungeeGatewayResult.rows.length} rows)`);

      for (const row of bungeeGatewayResult.rows) {
        // Parse operations to check transaction status
        let operations: Operation[] = [];
        try {
          operations = typeof row.operations === 'string' ? JSON.parse(row.operations) : row.operations || [];
        } catch {
          operations = [];
        }

        // Skip failed/reverted transactions
        if (operations.length > 0 && operations[0].status === false) {
          continue;
        }

        let txUsdValue = 0;

        // Priority 1: Use pre-calculated total_usd_volume if reasonable
        const rawUsdVolume = parseFloat(row.total_usd_volume || '0');
        if (rawUsdVolume > 0 && rawUsdVolume < 1_000_000) {
          txUsdValue = rawUsdVolume;
        }
        // Priority 2: Use eth_value_decimal
        else if (row.eth_value_decimal && parseFloat(row.eth_value_decimal) > 0) {
          txUsdValue = parseFloat(row.eth_value_decimal) * ethPrice;
        }
        // Priority 3: Use raw transaction value (wei)
        else if (row.value && parseFloat(row.value) > 0) {
          txUsdValue = (parseFloat(row.value) / 1e18) * ethPrice;
        }
        // Priority 4: Extract from operations (first operation's value)
        else if (operations.length > 0 && operations[0].value) {
          const opValue = parseFloat(operations[0].value) / 1e18;
          if (opValue > 0 && opValue < 10000) {
            txUsdValue = opValue * ethPrice;
          }
        }

        // Only count if we have a valid, reasonable USD value
        if (txUsdValue > 0 && txUsdValue < 1_000_000) {
          platformData['Bungee'].usdValue += txUsdValue;
          platformData['Bungee'].txCount += 1;
          totalTxCount += 1;
        }
      }
    } catch (dbError: unknown) {
      console.error('Error querying Bungee:', dbError instanceof Error ? dbError.message : dbError);
    }


    // Build byPlatform array
    const byPlatform = Object.entries(ALL_BRIDGE_PLATFORMS).map(([platform, config]) => ({
      platform,
      ethValue: platformData[platform].ethValue,
      usdValue: platformData[platform].usdValue,
      txCount: platformData[platform].txCount,
      logo: config.logo,
      url: config.url,
      ...(platformData[platform].bridgedInUsd !== undefined && {
        bridgedInUsd: platformData[platform].bridgedInUsd,
        bridgedInCount: platformData[platform].bridgedInCount,
      }),
      ...(platformData[platform].bridgedOutUsd !== undefined && {
        bridgedOutUsd: platformData[platform].bridgedOutUsd,
        bridgedOutCount: platformData[platform].bridgedOutCount,
      }),
    }));

    byPlatform.sort((a, b) => b.usdValue - a.usdValue);

    const totalUsd = Object.values(platformData).reduce((sum, p) => sum + p.usdValue, 0);

    const response: BridgeVolumeResponse = {
      totalEth,
      totalUsd,
      txCount: totalTxCount,
      bridgedInUsd,
      bridgedInCount,
      bridgedOutUsd,
      bridgedOutCount,
      byPlatform,
    };

    responseCache.set(cacheKey, response);

    const totalTime = Date.now() - requestStart;
    console.log(`[Bridge ${walletAddress}] TOTAL REQUEST TIME: ${totalTime}ms`);

    return res.json(response);
  } catch (error) {
    console.error('Error fetching bridge volume:', error);
    res.status(500).json({ error: 'Failed to fetch bridge volume' });
  }
});


// ============================================
// Swap Volume Route
// ============================================

export interface SwapVolumeResponse {
  totalEth: number;
  totalUsd: number;
  txCount: number;
  byPlatform: Array<{
    platform: string;
    contractAddress: string;
    ethValue: number;
    usdValue: number;
    txCount: number;
  }>;
}

// Known swap contract addresses and their platform names
const SWAP_CONTRACTS: Record<string, string> = {
  '0x551134e92e537ceaa217c2ef63210af3ce96a065': 'InkySwap',
  '0xd7e72f3615aa65b92a4dbdc211e296a35512988b': 'Curve',
  '0x9b17690de96fcfa80a3acaefe11d936629cd7a77': 'DyorSwap',
  '0x01d40099fcd87c018969b0e8d4ab1633fb34763c': 'Velodrome',
};

// Common swap method IDs
const SWAP_METHOD_IDS = [
  '0x7ff36ab5', '0x18cbafe5', '0x38ed1739', '0xfb3bdb41',
  '0x4a25d94a', '0x8803dbee', '0xb6f9de95', '0x791ac947',
  '0x5c11d795', '0x3593564c', '0xaad348a2',
];

// GET /api/wallet/:address/swap
router.get('/:address/swap', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    if (!isValidAddress(address)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    const walletAddress = address.toLowerCase();

    const cacheKey = `wallet:swap:${walletAddress}`;
    const cached = responseCache.get<SwapVolumeResponse>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const ALLOWED_DEX_CONTRACTS = Object.keys(SWAP_CONTRACTS).map(addr => addr.toLowerCase());

    const result = await pool.query(
      `SELECT 
         contract_address,
         tx_hash,
         value,
         logs,
         COALESCE(total_usd_volume, 0) as total_usd_volume,
         COALESCE(eth_value_decimal, 0) as eth_value_decimal,
         COALESCE(eth_price_usd, 3500) as eth_price_usd
       FROM transaction_enrichment
       WHERE LOWER(wallet_address) = LOWER($1)
         AND method_id = ANY($2)
         AND LOWER(contract_address) = ANY($3)`,
      [address, SWAP_METHOD_IDS, ALLOWED_DEX_CONTRACTS]
    );

    const platformAggregates = new Map<string, { ethValue: number; usdValue: number; txCount: number }>();

    console.log(`\n[SWAP VOLUME DEBUG] Processing ${result.rows.length} transactions for wallet ${walletAddress}`);

    for (const row of result.rows) {
      const contractAddr = row.contract_address.toLowerCase();
      const txHash = row.tx_hash;
      const platformName = SWAP_CONTRACTS[contractAddr] || 'Unknown DEX';

      let usdValue = parseFloat(row.total_usd_volume || '0');
      let dataSource = 'total_usd_volume';

      if (usdValue === 0) {
        const ethValue = parseFloat(row.eth_value_decimal || '0');
        const ethPrice = parseFloat(row.eth_price_usd || '3500');
        if (ethValue > 0) {
          usdValue = ethValue * ethPrice;
          dataSource = 'eth_value_decimal * eth_price';
          console.log(`[${platformName}] tx: ${txHash} | USD: $${usdValue.toFixed(2)} | Source: ${dataSource} (ETH: ${ethValue}, Price: $${ethPrice})`);
        } else if (row.value) {
          const rawValue = BigInt(row.value || '0');
          const ethFromRaw = Number(rawValue) / 1e18;
          usdValue = ethFromRaw * ethPrice;
          dataSource = 'raw_value * eth_price';
          console.log(`[${platformName}] tx: ${txHash} | USD: $${usdValue.toFixed(2)} | Source: ${dataSource} (Raw ETH: ${ethFromRaw}, Price: $${ethPrice})`);
        }
      } else {
        console.log(`[${platformName}] tx: ${txHash} | USD: $${usdValue.toFixed(2)} | Source: ${dataSource}`);
      }

      // Sanity check
      if (usdValue > 1_000_000_000) {
        console.warn(`[${platformName}] ⚠️  SKIPPED tx: ${txHash} | USD: $${usdValue.toFixed(2)} | Reason: Exceeds $1B sanity check`);
        continue;
      }

      // Log suspiciously high values
      if (usdValue > 100_000) {
        console.warn(`[${platformName}] ⚠️  HIGH VALUE tx: ${txHash} | USD: $${usdValue.toFixed(2)} | Source: ${dataSource}`);
      }

      const existing = platformAggregates.get(contractAddr) || { ethValue: 0, usdValue: 0, txCount: 0 };
      existing.usdValue += usdValue;
      existing.txCount += 1;
      platformAggregates.set(contractAddr, existing);
    }

    let totalEth = 0;
    let totalUsd = 0;
    let totalTxCount = 0;
    const byPlatform: SwapVolumeResponse['byPlatform'] = [];

    console.log(`\n[SWAP VOLUME DEBUG] Aggregating results by platform:`);

    for (const [contractAddr, aggregate] of platformAggregates) {
      totalEth += aggregate.ethValue;
      totalUsd += aggregate.usdValue;
      totalTxCount += aggregate.txCount;

      const platformName = SWAP_CONTRACTS[contractAddr] || 'Unknown DEX';

      console.log(`[${platformName}] Total USD: $${aggregate.usdValue.toFixed(2)} | Tx Count: ${aggregate.txCount}`);

      byPlatform.push({
        platform: platformName,
        contractAddress: contractAddr,
        ethValue: aggregate.ethValue,
        usdValue: aggregate.usdValue,
        txCount: aggregate.txCount,
      });
    }

    console.log(`\n[SWAP VOLUME DEBUG] FINAL TOTALS for ${walletAddress}:`);
    console.log(`  Total USD: $${totalUsd.toFixed(2)}`);
    console.log(`  Total Tx Count: ${totalTxCount}`);
    console.log(`  Platforms: ${byPlatform.length}\n`);

    byPlatform.sort((a, b) => b.usdValue - a.usdValue);

    const response: SwapVolumeResponse = {
      totalEth,
      totalUsd,
      txCount: totalTxCount,
      byPlatform,
    };

    responseCache.set(cacheKey, response);

    return res.json(response);
  } catch (error) {
    console.error('Error fetching swap volume:', error);
    res.status(500).json({ error: 'Failed to fetch swap volume' });
  }
});



// ============================================
// Wallet Score Route
// ============================================

// GET /api/wallet/:address/score
router.get('/:address/score', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    if (!isValidAddress(address)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    const walletAddress = address.toLowerCase();
    const forceRefresh = req.query.refresh === 'true';

    const cacheKey = `wallet:score:${walletAddress}`;

    if (!forceRefresh) {
      const cached = responseCache.get(cacheKey);
      if (cached) {
        return res.json(cached);
      }
    }

    const score = await pointsServiceV2.calculateWalletScore(address);
    responseCache.set(cacheKey, score);

    return res.json(score);
  } catch (error) {
    console.error('Failed to calculate wallet score:', error);

    const { address } = req.params;
    const emptyScore = {
      wallet_address: address.toLowerCase(),
      total_points: 0,
      rank: null,
      breakdown: { native: {}, platforms: {} },
      last_updated: new Date(),
    };

    return res.json(emptyScore);
  }
});


// ============================================
// Total Volume Route
// ============================================

export interface TotalVolumeResponse {
  totalEth: number;
  totalUsd: number;
  txCount: number;
  incoming: {
    eth: number;
    usd: number;
    count: number;
  };
  outgoing: {
    eth: number;
    usd: number;
    count: number;
  };
}

// GET /api/wallet/:address/volume
router.get('/:address/volume', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;

    if (!isValidAddress(address)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    const walletAddress = address.toLowerCase();

    const cacheKey = `wallet:volume:${walletAddress}`;
    const cached = responseCache.get<TotalVolumeResponse>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const [ethPriceResult, outgoingResult] = await Promise.all([
      query<{ price_usd: number }>(`SELECT price_usd FROM eth_prices ORDER BY timestamp DESC LIMIT 1`),
      query<{ total_eth: string; tx_count: string }>(`
        SELECT 
          COALESCE(SUM(CAST(eth_value AS NUMERIC) / 1e18), 0) as total_eth,
          COUNT(*) as tx_count
        FROM transaction_details
        WHERE wallet_address = $1 AND status = 1
      `, [walletAddress])
    ]);

    const ethPrice = ethPriceResult[0]?.price_usd || 3500;
    const outgoingEth = parseFloat(outgoingResult[0]?.total_eth || '0');
    const outgoingCount = parseInt(outgoingResult[0]?.tx_count || '0');

    const incomingEth = 0;
    const incomingCount = 0;

    const totalEth = outgoingEth + incomingEth;
    const totalUsd = totalEth * ethPrice;

    const response: TotalVolumeResponse = {
      totalEth,
      totalUsd,
      txCount: outgoingCount + incomingCount,
      incoming: {
        eth: incomingEth,
        usd: incomingEth * ethPrice,
        count: incomingCount,
      },
      outgoing: {
        eth: outgoingEth,
        usd: outgoingEth * ethPrice,
        count: outgoingCount,
      },
    };

    responseCache.set(cacheKey, response);

    return res.json(response);
  } catch (error) {
    console.error('Error fetching total volume:', error);

    const emptyResponse: TotalVolumeResponse = {
      totalEth: 0,
      totalUsd: 0,
      txCount: 0,
      incoming: { eth: 0, usd: 0, count: 0 },
      outgoing: { eth: 0, usd: 0, count: 0 },
    };

    return res.json(emptyResponse);
  }
});
