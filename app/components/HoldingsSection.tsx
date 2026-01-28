"use client";

import React from 'react';
import { Coins, Image } from './Icons';
import { getProxiedImageUrl } from '@/lib/utils/imageProxy';

type TokenType = 'meme' | 'stablecoin' | 'native' | 'defi' | 'governance' | 'utility' | null;

interface TokenHolding {
  name: string;
  symbol: string;
  address: string;
  logo: string;
  balance: number;
  usdValue: number;
  tokenType?: TokenType;
}

interface NftCollectionHolding {
  name: string;
  address: string;
  logo: string;
  count: number;
}

interface HoldingsSectionProps {
  tokenHoldings: TokenHolding[];
  nftCollections: NftCollectionHolding[];
  nativeEthUsd: number;
  nativeEthBalance: number;
}

// Token type badge styles
const tokenTypeBadgeStyles: Record<string, { bg: string; text: string; label: string }> = {
  meme: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'MEME' },
  stablecoin: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'STABLE' },
  native: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'NATIVE' },
  defi: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'DEFI' },
  governance: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'GOV' },
  utility: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', label: 'UTILITY' },
};

const TokenTypeBadge: React.FC<{ type: TokenType }> = ({ type }) => {
  if (!type) return null;
  
  const style = tokenTypeBadgeStyles[type];
  if (!style) return null;

  return (
    <span className={`${style.bg} ${style.text} text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider`}>
      {style.label}
    </span>
  );
};

export const HoldingsSection: React.FC<HoldingsSectionProps> = ({
  tokenHoldings,
  nftCollections,
  nativeEthUsd,
  nativeEthBalance,
}) => {
  // Filter out USDGLO token and separate meme coins from regular tokens
  const filteredTokens = tokenHoldings.filter(token => token.symbol !== 'USDGLO');
  const memeCoins = filteredTokens.filter(token => token.tokenType === 'meme');
  const regularTokens = filteredTokens.filter(token => token.tokenType !== 'meme');

  // Custom sort order for meme coins: ANITA -> CAT -> PURPLE -> AK47 -> KRAKMASK -> BERT
  const memeCoinsOrder = ['ANITA', 'CAT', 'PURPLE', 'ANDRU', 'KRAK', 'BERT'];
  const sortedMemeCoins = [...memeCoins].sort((a, b) => {
    const indexA = memeCoinsOrder.indexOf(a.symbol);
    const indexB = memeCoinsOrder.indexOf(b.symbol);
    
    // If both tokens are in our custom order, sort by that order
    if (indexA !== -1 && indexB !== -1) {
      return indexA - indexB;
    }
    
    // If only one is in our custom order, prioritize it
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    
    // If neither is in our custom order, sort alphabetically
    return a.symbol.localeCompare(b.symbol);
  });

  // Sort NFT collections to put Rekt Ink first
  const sortedNftCollections = [...nftCollections].sort((a, b) => {
    if (a.name === 'Rekt Ink') return -1;
    if (b.name === 'Rekt Ink') return 1;
    return 0;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
      {/* Token Holdings Card */}
      <div className="glass-card p-6 rounded-xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <div className="flex items-center -space-x-3">
              {regularTokens.slice(0, 3).map((token, i) => (
                <img
                  key={i}
                  src={getProxiedImageUrl(token.logo)}
                  alt={token.symbol}
                  className="w-7 h-7 rounded-full object-cover bg-slate-800"
                  style={{ zIndex: 3 - i }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${token.symbol.charAt(0)}&background=334155&color=94a3b8&size=28`;
                  }}
                />
              ))}
            </div>
            Token Holdings
          </h3>
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
            {regularTokens.length} tokens
          </span>
        </div>
        <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {regularTokens.map((token) => {
            // For ETH token, use native balance and USD value
            const isEthToken = token.symbol === 'ETH';
            const displayUsdValue = isEthToken ? nativeEthUsd : token.usdValue;
            const displayBalance = isEthToken ? nativeEthBalance : token.balance;
            return (
              <div
                key={token.address}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={getProxiedImageUrl(token.logo)}
                    alt={token.symbol}
                    className="w-10 h-10 rounded-lg object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(token.symbol)}&background=334155&color=94a3b8`;
                    }}
                  />
                  <div>
                    <div className="font-medium text-white flex items-center gap-2">
                      {token.symbol}
                      <TokenTypeBadge type={token.tokenType || null} />
                    </div>
                    <div className="text-xs text-slate-500">{token.name}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-white font-display">
                    ${displayUsdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-slate-500">
                    {displayBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })} {token.symbol}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Meme Coins Card */}
      <div className="glass-card p-6 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <div className="flex items-center -space-x-3">
              {sortedMemeCoins.slice(0, 3).map((token, i) => (
                <img
                  key={i}
                  src={getProxiedImageUrl(token.logo)}
                  alt={token.symbol}
                  className="w-7 h-7 rounded-full object-cover bg-slate-800"
                  style={{ zIndex: 3 - i }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${token.symbol.charAt(0)}&background=334155&color=94a3b8&size=28`;
                  }}
                />
              ))}
              {sortedMemeCoins.length === 0 && (
                <div className="w-7 h-7 rounded-full border-2 border-yellow-500 bg-slate-800 flex items-center justify-center">
                  <span className="text-yellow-400 text-xs">🚀</span>
                </div>
              )}
            </div>
            Meme Coins
          </h3>
          <span className="text-xs text-yellow-400 bg-yellow-900/30 px-2 py-1 rounded border border-yellow-500/30">
            {sortedMemeCoins.length} memes
          </span>
        </div>
        <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {sortedMemeCoins.length > 0 ? (
            sortedMemeCoins.map((token) => (
              <div
                key={token.address}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <img
                    src={getProxiedImageUrl(token.logo)}
                    alt={token.symbol}
                    className="w-10 h-10 rounded-lg object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(token.symbol)}&background=334155&color=94a3b8`;
                    }}
                  />
                  <div>
                    <div className="font-medium text-white flex items-center gap-2">
                      {token.symbol}
                    </div>
                    <div className="text-xs text-slate-500">{token.name}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-yellow-400 font-display">
                    ${token.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-slate-500">
                    {token.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })} {token.symbol}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="text-4xl mb-3">🐸</div>
              <div className="text-slate-400 text-sm">No meme coins yet</div>
              <div className="text-slate-500 text-xs mt-1">Time to ape in?</div>
            </div>
          )}
        </div>
      </div>

      {/* NFT Collections Card */}
      <div className="glass-card p-6 rounded-xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <div className="flex items-center -space-x-3">
              {sortedNftCollections.slice(0, 3).map((collection, i) => (
                <img
                  key={i}
                  src={getProxiedImageUrl(collection.logo)}
                  alt={collection.name}
                  className="w-7 h-7 rounded-full object-cover  bg-slate-800"
                  style={{ zIndex: 3 - i }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${collection.name.charAt(0)}&background=334155&color=94a3b8&size=28`;
                  }}
                />
              ))}
            </div>
            NFT Collections
          </h3>
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
            {sortedNftCollections.filter(c => c.count > 0).length} held
          </span>
        </div>
        <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {sortedNftCollections.map((collection) => (
            <div
              key={collection.address}
              className="flex items-center justify-between p-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <img
                  src={getProxiedImageUrl(collection.logo)}
                  alt={collection.name}
                  className="w-10 h-10 rounded-lg object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(collection.name)}&background=334155&color=94a3b8`;
                  }}
                />
                <div className="font-medium text-white">{collection.name}</div>
              </div>
              <div className={`px-3 py-1 rounded-lg font-bold font-display ${
                collection.count > 0 
                  ? 'bg-pink-500/10 text-pink-400' 
                  : 'bg-slate-800 text-slate-500'
              }`}>
                {collection.count}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
