import { query } from '../db';
import { assetsService } from './assets-service';
import {
  Rank,
  WalletPointsBreakdown,
  WalletScoreResponse,
} from '../types/platforms';

// Cache for ranks (1 minute TTL)
interface RanksCache {
  ranks: Rank[];
  timestamp: number;
}
let ranksCache: RanksCache | null = null;
const RANKS_CACHE_TTL = 60 * 1000;

// Cache for meme token addresses (5 minute TTL)
interface MemeTokensCache {
  addresses: Set<string>;
  timestamp: number;
}
let memeTokensCache: MemeTokensCache | null = null;
const MEME_TOKENS_CACHE_TTL = 5 * 60 * 1000;

export class PointsServiceV2 {
  // Get meme token addresses from database
  private async getMemeTokenAddresses(): Promise<Set<string>> {
    if (memeTokensCache && Date.now() - memeTokensCache.timestamp < MEME_TOKENS_CACHE_TTL) {
      return memeTokensCache.addresses;
    }

    try {
      const memeCoins = await assetsService.getMemeCoins();
      const addresses = new Set(memeCoins.map(coin => coin.address.toLowerCase()));

      memeTokensCache = { addresses, timestamp: Date.now() };
      return addresses;
    } catch (error) {
      console.error('Failed to fetch meme token addresses:', error);
      // Fallback to hardcoded addresses if database fails
      return new Set([
        '0x0606fc632ee812ba970af72f8489baaa443c4b98', // ANITA
        '0x20c69c12abf2b6f8d8ca33604dd25c700c7e70a5', // CAT
        '0xd642b49d10cc6e1bc1c6945725667c35e0875f22', // PURPLE
        '0x2a1bce657f919ac3f9ab50b2584cfc77563a02ec', // ANDRU (AK47)
        '0x32bcb803f696c99eb263d60a05cafd8689026575', // KRAK (KRAKMASK)
        '0x62c99fac20b33b5423fdf9226179e973a8353e36', // BERT
      ]);
    }
  }

  private async isMemeToken(address: string): Promise<boolean> {
    const memeTokens = await this.getMemeTokenAddresses();
    return memeTokens.has(address.toLowerCase());
  }

  private async getCachedRanks(): Promise<Rank[]> {
    if (ranksCache && Date.now() - ranksCache.timestamp < RANKS_CACHE_TTL) {
      return ranksCache.ranks;
    }

    try {
      const rawRanks = await query<{
        id: number;
        name: string;
        min_points: string | number;
        max_points: string | number | null;
        logo_url: string | null;
        color: string | null;
        description: string | null;
        display_order: number;
        is_active: boolean;
      }>(`
        SELECT id, name, min_points, max_points, logo_url, color, description, display_order, is_active
        FROM ranks 
        WHERE is_active = true 
        ORDER BY min_points ASC
      `);

      // Parse numeric values (PostgreSQL may return them as strings)
      const ranks: Rank[] = rawRanks.map(r => ({
        ...r,
        min_points: typeof r.min_points === 'string' ? parseInt(r.min_points, 10) : r.min_points,
        max_points: r.max_points === null ? null : (typeof r.max_points === 'string' ? parseInt(r.max_points, 10) : r.max_points),
        created_at: new Date(),
        updated_at: new Date(),
      }));

      ranksCache = { ranks, timestamp: Date.now() };
      return ranks;
    } catch (error) {
      console.error('[Ranks] Failed to fetch ranks from database:', error);
      return [];
    }
  }

  private getRankForPoints(ranks: Rank[], totalPoints: number): Rank | null {
    // Find the rank where totalPoints falls within min_points and max_points range
    for (const rank of ranks) {
      const minOk = totalPoints >= rank.min_points;
      const maxOk = rank.max_points === null || totalPoints <= rank.max_points;
      if (minOk && maxOk) {
        return rank;
      }
    }
    return null;
  }

  // Manual points calculation methods
  private calculateNftCollectionsPoints(nftCount: number): number {
    // New tiered system for NFT Collections (Max: 400 points)
    if (nftCount >= 10) return 400; // Tier 4: Diamond Hand
    if (nftCount >= 5) return 250;  // Tier 3: Museum
    if (nftCount >= 3) return 150;  // Tier 2: Collector
    if (nftCount >= 1) return 50;   // Tier 1: Art Fan
    return 0;
  }

  private async calculateTokenHoldingsPoints(tokenHoldings: Array<{ address: string; usdValue: number }>): Promise<number> {
    // New tiered system for Token Holdings (Max: 400 points)
    const memeTokens = await this.getMemeTokenAddresses();
    const totalUsd = tokenHoldings
      .filter(token => !memeTokens.has(token.address.toLowerCase()))
      .reduce((sum, token) => sum + (Number(token.usdValue) || 0), 0);
    if (isNaN(totalUsd)) return 0;
    
    if (totalUsd >= 10000) return 400; // Tier 4: Whale
    if (totalUsd >= 1000) return 300;  // Tier 3: Dolphin
    if (totalUsd >= 100) return 150;   // Tier 2: Crab
    if (totalUsd >= 1) return 50;      // Tier 1: Shrimp
    return 0;
  }

  private async calculateMemeCoinsPoints(tokenHoldings: Array<{ address: string; usdValue: number }>): Promise<number> {
    // New tiered system for Meme Coins (Max: 300 points)
    const memeTokens = await this.getMemeTokenAddresses();
    const totalUsd = tokenHoldings
      .filter(token => memeTokens.has(token.address.toLowerCase()))
      .reduce((sum, token) => sum + (Number(token.usdValue) || 0), 0);
    if (isNaN(totalUsd)) return 0;
    
    if (totalUsd >= 1000) return 300; // Tier 4: Meme Whale
    if (totalUsd >= 500) return 200;  // Tier 3: Shark
    if (totalUsd >= 100) return 100;  // Tier 2: Dolphin
    if (totalUsd >= 1) return 50;     // Tier 1: Shrimp
    return 0;
  }


  private calculateWalletAgePoints(ageDays: number): number {
    if (ageDays <= 0) return 0;
    if (ageDays <= 30) return 100;
    if (ageDays <= 90) return 200;
    if (ageDays <= 180) return 300;
    if (ageDays <= 365) return 400;
    if (ageDays <= 730) return 500;
    return 600;
  }

  private calculateTotalTxPoints(txCount: number): number {
    if (txCount <= 0) return 0;
    if (txCount <= 100) return 100;
    if (txCount <= 200) return 200;
    if (txCount <= 400) return 300;
    if (txCount <= 700) return 400;
    if (txCount <= 900) return 500;
    return 600;
  }

  private calculateBridgeInPoints(bridgeInVolumeUsd: number): number {
    return this.getBridgeVolumeTierPoints(bridgeInVolumeUsd);
  }

  private calculateBridgeOutPoints(bridgeOutVolumeUsd: number): number {
    return this.getBridgeVolumeTierPoints(bridgeOutVolumeUsd);
  }

  private getBridgeVolumeTierPoints(volumeUsd: number): number {
    // New tiered system for Bridge Volume (Max: 500 points)
    if (volumeUsd >= 10000) return 500; // Tier 5: Bridge Whale
    if (volumeUsd >= 5000) return 400;  // Tier 4: Connector
    if (volumeUsd >= 1000) return 250;  // Tier 3: Settler
    if (volumeUsd >= 100) return 100;   // Tier 2: Explorer
    if (volumeUsd >= 1) return 25;      // Tier 1: Tourist
    return 0;
  }

  private getBridgeTierName(volumeUsd: number): string {
    if (volumeUsd >= 10000) return '5 (Bridge Whale)';
    if (volumeUsd >= 5000) return '4 (Connector)';
    if (volumeUsd >= 1000) return '3 (Settler)';
    if (volumeUsd >= 100) return '2 (Explorer)';
    if (volumeUsd >= 1) return '1 (Tourist)';
    return '0 (None)';
  }

  private calculateGmPoints(gmCount: number): number {
    // New tiered system for GM (Max: 400 points)
    if (gmCount >= 150) return 400; // Tier 4: GM Machine
    if (gmCount >= 50) return 250;  // Tier 3: Routine
    if (gmCount >= 10) return 150;  // Tier 2: Coffee Time
    if (gmCount >= 1) return 50;    // Tier 1: Waking Up
    return 0;
  }

  private calculateInkyPumpPoints(createdCount: number, buyVolumeUsd: number, sellVolumeUsd: number): number {
    // New tiered system for InkyPump (Max: 400 points)
    // 1. Create Tokens (Max: 50 points)
    const createPoints = createdCount >= 3 ? 50 : createdCount >= 1 ? 25 : 0;
    
    // 2. Trading Volume (Max: 350 points)
    const totalVolume = buyVolumeUsd + sellVolumeUsd;
    let volumePoints = 0;
    if (totalVolume >= 10000) volumePoints = 350;
    else if (totalVolume >= 1000) volumePoints = 250;
    else if (totalVolume >= 100) volumePoints = 150;
    else if (totalVolume >= 1) volumePoints = 50;
    
    return createPoints + volumePoints;
  }

  private calculateTydroPoints(supplyUsd: number, borrowUsd: number): number {
    // New tiered system for Tydro
    const supplyPoints = this.getTydroSupplyTierPoints(supplyUsd);
    const borrowPoints = this.getTydroBorrowTierPoints(borrowUsd);
    return supplyPoints + borrowPoints; // Max: 2,500 points
  }

  private getTydroSupplyTierPoints(supplyUsd: number): number {
    // Max: 1,250 points
    if (supplyUsd >= 50000) return 1250; // Tier 5: Whale
    if (supplyUsd >= 10000) return 1000; // Tier 4: Shark
    if (supplyUsd >= 1000) return 600;   // Tier 3: Liquidity Provider
    if (supplyUsd >= 100) return 250;    // Tier 2: Supplier
    if (supplyUsd >= 1) return 50;       // Tier 1: Saver
    return 0;
  }

  private getTydroBorrowTierPoints(borrowUsd: number): number {
    // Max: 1,250 points
    if (borrowUsd >= 25000) return 1250; // Tier 5: Degen
    if (borrowUsd >= 5000) return 1000;  // Tier 4: Pro Borrower
    if (borrowUsd >= 500) return 600;    // Tier 3: Active User
    if (borrowUsd >= 50) return 250;     // Tier 2: Borrower
    if (borrowUsd >= 1) return 50;       // Tier 1: Tester
    return 0;
  }

  private calculateSwapVolumePoints(swapAmountUsd: number): number {
    // New tiered system for Swap Volume (Max: 500 points)
    if (swapAmountUsd >= 25000) return 500; // Tier 5: DEX Master
    if (swapAmountUsd >= 10000) return 400; // Tier 4: Swap Whale
    if (swapAmountUsd >= 5000) return 250;  // Tier 3: Active Trader
    if (swapAmountUsd >= 1000) return 100;  // Tier 2: Flipper
    if (swapAmountUsd >= 1) return 25;      // Tier 1: Shopper
    return 0;
  }

  private calculateShelliesPoints(playedGameCount: number, stakedNftCount: number, joinedRaffleCount: number): number {
    // New tiered system for Shellies (Max: 400 points)
    // 1. Pay to Play (Max: 150 points)
    let playPoints = 0;
    if (playedGameCount >= 50) playPoints = 150;
    else if (playedGameCount >= 10) playPoints = 75;
    else if (playedGameCount >= 1) playPoints = 25;
    
    // 2. Staked NFTs (Max: 150 points)
    let stakePoints = 0;
    if (stakedNftCount >= 5) stakePoints = 150;
    else if (stakedNftCount >= 3) stakePoints = 100;
    else if (stakedNftCount >= 1) stakePoints = 50;
    
    // 3. Joined Raffles (Max: 100 points)
    let rafflePoints = 0;
    if (joinedRaffleCount >= 10) rafflePoints = 100;
    else if (joinedRaffleCount >= 5) rafflePoints = 50;
    else if (joinedRaffleCount >= 1) rafflePoints = 25;
    
    return playPoints + stakePoints + rafflePoints;
  }

  private calculateZnsPoints(deployCount: number, saidGmCount: number, registerCount: number): number {
    // New tiered system for ZNS (Max: 300 points)
    // 1. Register Domain (Max: 200 points)
    const registerPoints = registerCount >= 3 ? 200 : registerCount >= 1 ? 100 : 0;
    
    // 2. Deploy Contract (Max: 50 points)
    const deployPoints = deployCount >= 3 ? 50 : deployCount >= 1 ? 20 : 0;
    
    // 3. GM Activity (Max: 50 points)
    const gmPoints = saidGmCount >= 10 ? 50 : saidGmCount >= 1 ? 20 : 0;
    
    return registerPoints + deployPoints + gmPoints;
  }

  private calculateMarvkPoints(cardMintedCount: number, lockTokenCount: number, vestTokenCount: number): number {
    // New tiered system for Marvk (Max: 300 points)
    // 1. Mint Card (Max: 100 points - one-time)
    const cardPoints = cardMintedCount >= 1 ? 100 : 0;
    
    // 2. Lock Token (Max: 100 points)
    const lockPoints = lockTokenCount >= 5 ? 100 : lockTokenCount >= 1 ? 50 : 0;
    
    // 3. Vest Token (Max: 100 points)
    const vestPoints = vestTokenCount >= 5 ? 100 : vestTokenCount >= 1 ? 50 : 0;
    
    return cardPoints + lockPoints + vestPoints;
  }

  private calculateNadoPoints(totalDeposits: number, totalVolume: number): number {
    // New tiered system for Nado (Max: 2,500 points)
    // 1. Deposits (Max: 1,250 points)
    let depositPoints = 0;
    if (totalDeposits >= 50000) depositPoints = 1250; // Tier 5: Whale
    else if (totalDeposits >= 10000) depositPoints = 1000; // Tier 4: Shark
    else if (totalDeposits >= 1000) depositPoints = 600; // Tier 3: Dolphin
    else if (totalDeposits >= 100) depositPoints = 250; // Tier 2: Shrimp
    else if (totalDeposits >= 1) depositPoints = 50; // Tier 1: Beginner
    
    // 2. Volume (Max: 1,250 points)
    let volumePoints = 0;
    if (totalVolume >= 25000000) volumePoints = 1250; // Tier 6: Legend
    else if (totalVolume >= 10000000) volumePoints = 1150; // Tier 5: Market Maker
    else if (totalVolume >= 5000000) volumePoints = 1000; // Tier 4: Big Shark
    else if (totalVolume >= 1000000) volumePoints = 800; // Tier 3: Ape
    else if (totalVolume >= 500000) volumePoints = 550; // Tier 2: Active Trader
    else if (totalVolume >= 100000) volumePoints = 300; // Tier 1: Standard
    else if (totalVolume >= 0) volumePoints = 50; // Tier 0: Testing
    
    return depositPoints + volumePoints;
  }

  private calculateCopinkPoints(subaccountsFound: number, totalVolume: number): number {
    // New tiered system for Copink (Max: 400 points)
    // 1. Volume (Max: 300 points)
    let volumePoints = 0;
    if (totalVolume >= 10000) volumePoints = 300;
    else if (totalVolume >= 5000) volumePoints = 250;
    else if (totalVolume >= 1000) volumePoints = 150;
    else if (totalVolume >= 1) volumePoints = 50;
    
    // 2. Subaccounts (Max: 100 points)
    const subaccountPoints = subaccountsFound >= 3 ? 100 : subaccountsFound >= 1 ? 50 : 0;
    
    return volumePoints + subaccountPoints;
  }

  private calculateNft2mePoints(collectionCreatedCount: number, nftMintedCount: number): number {
    // New tiered system for NFT2Me (Max: 300 points)
    // 1. Create Collection (Max: 100 points)
    const collectionPoints = collectionCreatedCount >= 3 ? 100 : collectionCreatedCount >= 1 ? 50 : 0;
    
    // 2. Mint NFTs (Max: 200 points)
    let mintPoints = 0;
    if (nftMintedCount >= 100) mintPoints = 200;
    else if (nftMintedCount >= 10) mintPoints = 100;
    else if (nftMintedCount >= 1) mintPoints = 50;
    
    return collectionPoints + mintPoints;
  }

  // NFT marketplace contract addresses
  private readonly NFT_CONTRACTS = {
    squid: '0x9ebf93fdba9f32accab3d6716322dccd617a78f3',
    netProtocol: '0xd00c96804e9ff35f10c7d2a92239c351ff3f94e5',
    mintique: '0xbd6a027b85fd5285b1623563bbef6fadbe396afb',
  };

  private calculateNftTradingPoints(squidCount: number, netProtocolCount: number, mintiqueCount: number): number {
    // New tiered system for NFT Trading (Max: 400 points)
    // 1. Platforms Used (Max: 100 points)
    let platformPoints = 0;
    if (squidCount > 0) platformPoints += 50;
    if (netProtocolCount > 0) platformPoints += 35;
    if (mintiqueCount > 0) platformPoints += 15;
    
    // 2. Trade Count (Max: 300 points)
    const totalTrades = squidCount + netProtocolCount + mintiqueCount;
    let tradePoints = 0;
    if (totalTrades >= 10) tradePoints = 300;
    else if (totalTrades >= 5) tradePoints = 150;
    else if (totalTrades >= 1) tradePoints = 50;
    
    return platformPoints + tradePoints;
  }


  async calculateWalletScore(walletAddress: string): Promise<WalletScoreResponse> {
    const wallet = walletAddress.toLowerCase();
    const breakdown: WalletPointsBreakdown = {
      native: {},
      platforms: {},
    };
    let totalPoints = 0;

    try {
      // Use the same endpoints as the dashboard
      const baseUrl = process.env.API_BASE_URL || 'http://localhost:4000';

      const [
        walletStatsRes,
        bridgeRes,
        swapRes,
        tydroRes,
        gmRes,
        inkyPumpCreatedRes,
        inkyPumpBuyRes,
        inkyPumpSellRes,
        shelliesRafflesRes,
        shelliesPayToPlayRes,
        shelliesStakingRes,
        znsRes,
        nft2meRes,
        nftTradingRes,
        marvkRes,
        nadoRes,
        copinkRes
      ] = await Promise.all([
        fetch(`${baseUrl}/api/wallet/${wallet}/stats`),
        fetch(`${baseUrl}/api/wallet/${wallet}/bridge`),
        fetch(`${baseUrl}/api/wallet/${wallet}/swap`),
        fetch(`${baseUrl}/api/wallet/${wallet}/tydro`),
        fetch(`${baseUrl}/api/analytics/${wallet}/gm_count`),
        fetch(`${baseUrl}/api/analytics/${wallet}/inkypump_created_tokens`),
        fetch(`${baseUrl}/api/analytics/${wallet}/inkypump_buy_volume`),
        fetch(`${baseUrl}/api/analytics/${wallet}/inkypump_sell_volume`),
        fetch(`${baseUrl}/api/analytics/${wallet}/shellies_joined_raffles`),
        fetch(`${baseUrl}/api/analytics/${wallet}/shellies_pay_to_play`),
        fetch(`${baseUrl}/api/analytics/${wallet}/shellies_staking`),
        fetch(`${baseUrl}/api/analytics/${wallet}/zns`),
        fetch(`${baseUrl}/api/wallet/${wallet}/nft2me`),
        fetch(`${baseUrl}/api/analytics/${wallet}/nft_traded`),
        fetch(`${baseUrl}/api/marvk/${wallet}`),
        fetch(`${baseUrl}/api/nado/${wallet}`),
        fetch(`${baseUrl}/api/copink/${wallet}`)
      ]);

      // Type definitions for API responses
      interface WalletStatsResponse {
        nftCollections?: Array<{ count?: number }>;
        tokenHoldings?: Array<{ address: string; symbol?: string; usdValue: number }>;
        balanceUsd?: number;
        ageDays?: number;
        totalTxns?: number;
      }
      interface BridgeResponse { bridgedInUsd?: number; bridgedInCount?: number; bridgedOutUsd?: number; bridgedOutCount?: number; }
      interface SwapResponse { totalUsd?: number; txCount?: number; }
      interface TydroResponse { currentSupplyUsd?: number; currentBorrowUsd?: number; depositCount?: number; borrowCount?: number; }
      interface CountResponse { total_count?: number; total_value?: string; }
      interface ZnsResponse {
        total_count?: number;
        deploy_count?: number;
        say_gm_count?: number;
        register_domain_count?: number;
      }
      interface Nft2meResponse { collectionsCreated?: number; nftsMinted?: number; totalTransactions?: number; }
      interface NftTradingResponse {
        total_count?: number;
        by_contract?: Array<{ contract_address: string; count: number }>;
      }
      interface MarvkResponse {
        lockTokenCount?: number;
        vestTokenCount?: number;
        cardMintedCount?: number;
        totalTransactions?: number;
      }
      interface NadoResponse {
        totalDeposits?: number;
        totalTransactions?: number;
        nadoVolumeUSD?: number;
      }
      interface CopinkResponse {
        totalVolume?: number;
        subaccountsFound?: number;
      }

      const walletStats = walletStatsRes.ok ? await walletStatsRes.json() as WalletStatsResponse : null;
      const bridgeData = bridgeRes.ok ? await bridgeRes.json() as BridgeResponse : null;
      const swapData = swapRes.ok ? await swapRes.json() as SwapResponse : null;
      const tydroData = tydroRes.ok ? await tydroRes.json() as TydroResponse : null;
      const gmData = gmRes.ok ? await gmRes.json() as CountResponse : null;
      const inkyPumpCreated = inkyPumpCreatedRes.ok ? await inkyPumpCreatedRes.json() as CountResponse : null;
      const inkyPumpBuy = inkyPumpBuyRes.ok ? await inkyPumpBuyRes.json() as CountResponse : null;
      const inkyPumpSell = inkyPumpSellRes.ok ? await inkyPumpSellRes.json() as CountResponse : null;
      const shelliesRaffles = shelliesRafflesRes.ok ? await shelliesRafflesRes.json() as CountResponse : null;
      const shelliesPayToPlay = shelliesPayToPlayRes.ok ? await shelliesPayToPlayRes.json() as CountResponse : null;
      const shelliesStaking = shelliesStakingRes.ok ? await shelliesStakingRes.json() as CountResponse : null;
      const znsData = znsRes.ok ? await znsRes.json() as ZnsResponse : null;
      const nft2meData = nft2meRes.ok ? await nft2meRes.json() as Nft2meResponse : null;
      const nftTradingData = nftTradingRes.ok ? await nftTradingRes.json() as NftTradingResponse : null;
      const marvkData = marvkRes.ok ? await marvkRes.json() as MarvkResponse : null;
      const nadoData = nadoRes.ok ? await nadoRes.json() as NadoResponse : null;
      const copinkData = copinkRes.ok ? await copinkRes.json() as CopinkResponse : null;

      if (!walletStats) throw new Error('Failed to fetch wallet stats');

      // Calculate points using dashboard data
      const supportedNftCount = (walletStats.nftCollections || []).reduce((sum: number, col: { count?: number }) => sum + (col.count || 0), 0);
      const nftPoints = this.calculateNftCollectionsPoints(supportedNftCount);
      breakdown.native['nft_collections'] = { value: supportedNftCount, points: nftPoints };
      totalPoints += nftPoints;

      const tokenHoldings = walletStats.tokenHoldings || [];
      const nativeEthUsd = Number(walletStats.balanceUsd) || 0;

      const allHoldings = [
        ...tokenHoldings,
        { address: '0x0000000000000000000000000000000000000000', symbol: 'ETH', usdValue: nativeEthUsd }
      ];

      const tokenPoints = await this.calculateTokenHoldingsPoints(allHoldings);
      const totalTokenValue = allHoldings.reduce((sum: number, t: { usdValue?: number }) => sum + (Number(t.usdValue) || 0), 0);
      breakdown.native['erc20_tokens'] = { value: totalTokenValue, points: tokenPoints };
      totalPoints += tokenPoints;

      const memePoints = await this.calculateMemeCoinsPoints(tokenHoldings);
      const memeTokens = await this.getMemeTokenAddresses();
      const memeTokenCount = tokenHoldings.filter((t: { address: string }) => memeTokens.has(t.address.toLowerCase())).length;
      breakdown.native['meme_coins'] = { value: memeTokenCount, points: memePoints };
      totalPoints += memePoints;

      const agePoints = this.calculateWalletAgePoints(walletStats.ageDays || 0);
      breakdown.native['wallet_age'] = { value: walletStats.ageDays || 0, points: agePoints };
      totalPoints += agePoints;

      const txPoints = this.calculateTotalTxPoints(walletStats.totalTxns || 0);
      breakdown.native['total_tx'] = { value: walletStats.totalTxns || 0, points: txPoints };
      totalPoints += txPoints;

      const bridgeInUsd = bridgeData?.bridgedInUsd || 0;
      const bridgeOutUsd = bridgeData?.bridgedOutUsd || 0;
      const bridgeInPoints = this.calculateBridgeInPoints(bridgeInUsd);
      const bridgeOutPoints = this.calculateBridgeOutPoints(bridgeOutUsd);
      breakdown.platforms['bridge_in'] = { tx_count: bridgeData?.bridgedInCount || 0, usd_volume: bridgeInUsd, points: bridgeInPoints };
      breakdown.platforms['bridge_out'] = { tx_count: bridgeData?.bridgedOutCount || 0, usd_volume: bridgeOutUsd, points: bridgeOutPoints };
      totalPoints += bridgeInPoints + bridgeOutPoints;

      const gmCount = gmData?.total_count || 0;
      const gmPoints = this.calculateGmPoints(gmCount);
      breakdown.platforms['gm'] = { tx_count: gmCount, usd_volume: 0, points: gmPoints };
      totalPoints += gmPoints;

      const inkyPumpCreatedCount = inkyPumpCreated?.total_count || 0;
      const inkyPumpBuyUsd = parseFloat(inkyPumpBuy?.total_value || '0');
      const inkyPumpSellUsd = parseFloat(inkyPumpSell?.total_value || '0');
      const inkyPumpPoints = this.calculateInkyPumpPoints(inkyPumpCreatedCount, inkyPumpBuyUsd, inkyPumpSellUsd);
      const inkyPumpTotalUsd = inkyPumpBuyUsd + inkyPumpSellUsd;
      breakdown.platforms['inkypump'] = { tx_count: inkyPumpCreatedCount + (inkyPumpBuy?.total_count || 0) + (inkyPumpSell?.total_count || 0), usd_volume: inkyPumpTotalUsd, points: inkyPumpPoints };
      totalPoints += inkyPumpPoints;

      const tydroSupplyUsd = tydroData?.currentSupplyUsd || 0;
      const tydroBorrowUsd = tydroData?.currentBorrowUsd || 0;
      const tydroPoints = this.calculateTydroPoints(tydroSupplyUsd, tydroBorrowUsd);
      breakdown.platforms['tydro'] = { tx_count: (tydroData?.depositCount || 0) + (tydroData?.borrowCount || 0), usd_volume: tydroSupplyUsd + tydroBorrowUsd, points: tydroPoints };
      totalPoints += tydroPoints;

      const swapUsd = swapData?.totalUsd || 0;
      const swapPoints = this.calculateSwapVolumePoints(swapUsd);
      breakdown.platforms['swap'] = { tx_count: swapData?.txCount || 0, usd_volume: swapUsd, points: swapPoints };
      totalPoints += swapPoints;

      const shelliesPlayedCount = shelliesPayToPlay?.total_count || 0;
      const shelliesStakedCount = shelliesStaking?.total_count || 0;
      const shelliesRafflesCount = shelliesRaffles?.total_count || 0;
      const shelliesPoints = this.calculateShelliesPoints(shelliesPlayedCount, shelliesStakedCount, shelliesRafflesCount);
      breakdown.platforms['shellies'] = { tx_count: shelliesPlayedCount + shelliesStakedCount + shelliesRafflesCount, usd_volume: 0, points: shelliesPoints };
      totalPoints += shelliesPoints;

      const znsDeployCount = znsData?.deploy_count || 0;
      const znsSaidGmCount = znsData?.say_gm_count || 0;
      const znsRegisterCount = znsData?.register_domain_count || 0;
      const znsPoints = this.calculateZnsPoints(znsDeployCount, znsSaidGmCount, znsRegisterCount);
      breakdown.platforms['zns'] = { tx_count: znsData?.total_count || 0, usd_volume: 0, points: znsPoints };
      totalPoints += znsPoints;

      const nft2meCollectionsCount = nft2meData?.collectionsCreated || 0;
      const nft2meMintedCount = nft2meData?.nftsMinted || 0;
      const nft2mePoints = this.calculateNft2mePoints(nft2meCollectionsCount, nft2meMintedCount);
      breakdown.platforms['nft2me'] = { tx_count: nft2meData?.totalTransactions || 0, usd_volume: 0, points: nft2mePoints };
      totalPoints += nft2mePoints;

      // Parse NFT trading by contract
      const byContract = nftTradingData?.by_contract || [];
      const squidCount = byContract.find(c => c.contract_address === this.NFT_CONTRACTS.squid)?.count || 0;
      const netProtocolCount = byContract.find(c => c.contract_address === this.NFT_CONTRACTS.netProtocol)?.count || 0;
      const mintiqueCount = byContract.find(c => c.contract_address === this.NFT_CONTRACTS.mintique)?.count || 0;
      const nftTradingPoints = this.calculateNftTradingPoints(squidCount, netProtocolCount, mintiqueCount);
      breakdown.platforms['nft_trading'] = { tx_count: nftTradingData?.total_count || 0, usd_volume: 0, points: nftTradingPoints };
      totalPoints += nftTradingPoints;

      // Marvk points
      const marvkCardMinted = marvkData?.cardMintedCount || 0; // Placeholder until API is implemented
      const marvkLockCount = marvkData?.lockTokenCount || 0;
      const marvkVestCount = marvkData?.vestTokenCount || 0;
      const marvkPoints = this.calculateMarvkPoints(marvkCardMinted, marvkLockCount, marvkVestCount);
      breakdown.platforms['marvk'] = { tx_count: marvkData?.totalTransactions || 0, usd_volume: 0, points: marvkPoints };
      totalPoints += marvkPoints;

      // Nado points
      const nadoTotalDeposits = nadoData?.totalDeposits || 0;
      const nadoTotalVolume = nadoData?.nadoVolumeUSD || 0;
      const nadoPoints = this.calculateNadoPoints(nadoTotalDeposits, nadoTotalVolume);
      breakdown.platforms['nado'] = { tx_count: nadoData?.totalTransactions || 0, usd_volume: nadoTotalVolume, points: nadoPoints };
      totalPoints += nadoPoints;

      // Copink points
      const copinkSubaccounts = copinkData?.subaccountsFound || 0;
      const copinkVolume = copinkData?.totalVolume || 0;
      const copinkPoints = this.calculateCopinkPoints(copinkSubaccounts, copinkVolume);
      breakdown.platforms['copink'] = { tx_count: copinkSubaccounts, usd_volume: copinkVolume, points: copinkPoints };
      totalPoints += copinkPoints;

      // Verification logs - check formula correctness


      const ranks = await this.getCachedRanks();
      const rank = this.getRankForPoints(ranks, totalPoints);

      return {
        wallet_address: wallet,
        total_points: totalPoints,
        rank: rank ? { name: rank.name, color: rank.color, logo_url: rank.logo_url } : null,
        breakdown,
        last_updated: new Date(),
      };
    } catch (error) {
      console.error('Error calculating wallet score:', error);
      throw error;
    }
  }
}

export const pointsServiceV2 = new PointsServiceV2();
