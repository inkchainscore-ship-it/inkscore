"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Logo } from '../components/Logo';
import {
  ArrowLeft,
  Wallet,
  Award,
  ExternalLink
} from '../components/Icons';

interface Rank {
  id: number;
  name: string;
  min_points: number;
  max_points: number | null;
  logo_url: string | null;
  color: string | null;
  description: string | null;
}

// Platform logos from Dashboard
const PLATFORM_LOGOS: Record<string, string> = {
  gm: 'https://gm.inkonchain.com/favicon.ico',
  inkypump: 'https://www.inkypump.com/favicon.ico',
  tydro: 'https://app.tydro.com/tydro-logo.svg',
  zns: 'https://pbs.twimg.com/profile_images/1813882885406965760/7wkPAsLn_400x400.jpg',
  nft2me: 'https://pbs.twimg.com/profile_images/1626191411384053761/NoRNmw9L_400x400.png',
  marvk: 'https://pbs.twimg.com/profile_images/1969128458635689984/DRv5vIT2_400x400.jpg',
  shellies: 'https://pbs.twimg.com/profile_images/1948768160733175808/aNFNH1IH_400x400.jpg',
  relay: 'https://relay.link/favicon.ico',
  inkOfficial: 'https://inkonchain.com/favicon.ico',
  bungee: 'https://www.bungee.exchange/favicon.ico',
  usdt0: 'https://pbs.twimg.com/profile_images/1879546764971188224/SQISVYwX_400x400.jpg',
  inkyswap: 'https://inkyswap.com/logo-mobile.svg',
  dyorswap: 'https://dyorswap.finance/favicon.ico',
  velodrome: 'https://velodrome.finance/images/VELO/favicon.ico',
  curve: 'https://cdn.jsdelivr.net/gh/curvefi/curve-assets/branding/logo.png',
  squidMarket: 'https://www.squidmarket.xyz/favicon.ico',
  netProtocol: 'https://www.netprotocol.app/favicon.ico',
  mintiq: 'https://i.ibb.co/bMN9ppS7/mmm.png',
};

interface PlatformRule {
  name: string;
  logo?: string;
  logos?: { name: string; logo: string; url: string }[];
  description: string;
  formula: string;
  details: string[];
  color: string;
  url?: string;
}

const nativeMetrics: PlatformRule[] = [
  {
    name: 'Token Holdings',
    description: 'Points based on total USD value of non-meme tokens held',
    formula: 'Tiered: $1-$99 = 50pts, $100-$999 = 150pts, $1K-$10K = 300pts, $10K+ = 400pts',
    details: [
      'Tier 1: $1-$99 = 50 points (🦐 Shrimp)',
      'Tier 2: $100-$999 = 150 points (🦀 Crab)',
      'Tier 3: $1,000-$9,999 = 300 points (🐬 Dolphin)',
      'Tier 4: $10,000+ = 400 points (🐳 Whale)',
      'Includes native ETH and all ERC-20 tokens (excluding meme coins)',
    ],
    color: 'from-yellow-500 to-orange-500',
  },
  {
    name: 'Meme Coins',
    description: 'Points for holding supported meme tokens',
    formula: 'Tiered: $1-$99 = 50pts, $100-$499 = 100pts, $500-$999 = 200pts, $1K+ = 300pts',
    details: [
      'Tier 1: $1-$99 = 50 points (🦐 Shrimp)',
      'Tier 2: $100-$499 = 100 points (🐬 Dolphin)',
      'Tier 3: $500-$999 = 200 points (🦈 Shark)',
      'Tier 4: $1,000+ = 300 points (🐳 Meme Whale)',
      'Supported: ANITA, CAT, PURPLE, ANDRU, KRAK, BERT',
    ],
    color: 'from-pink-500 to-purple-500',
  },
  {
    name: 'NFT Collections',
    description: 'Points based on number of NFTs held',
    formula: 'Tiered: 1 = 50pts, 3 = 150pts, 5 = 250pts, 10+ = 400pts',
    details: [
      'Tier 1: 1 NFT = 50 points (🎨 Art Fan)',
      'Tier 2: 3 NFTs = 150 points (🖼️ Collector)',
      'Tier 3: 5 NFTs = 250 points (🏛️ Museum)',
      'Tier 4: 10+ NFTs = 400 points (💎 Diamond Hand)',
    ],
    color: 'from-purple-500 to-indigo-500',
  },
  {
    name: 'Wallet Age',
    description: 'Points based on how long your wallet has been active',
    formula: 'Tiered by days',
    details: [
      '1-30 days: 100 points',
      '31-90 days: 200 points',
      '91-180 days: 300 points',
      '181-365 days: 400 points',
      '366-730 days: 500 points',
      '730+ days: 600 points',
    ],
    color: 'from-green-500 to-emerald-500',
  },
  {
    name: 'Total Transactions',
    description: 'Points based on total number of transactions',
    formula: 'Tiered by count',
    details: [
      '1-100 txs: 100 points',
      '101-200 txs: 200 points',
      '201-400 txs: 300 points',
      '401-700 txs: 400 points',
      '701-900 txs: 500 points',
      '900+ txs: 600 points',
    ],
    color: 'from-blue-500 to-cyan-500',
  },
];

const platformMetrics: PlatformRule[] = [
  {
    name: 'Bridge IN',
    logos: [
      { name: 'Relay', logo: PLATFORM_LOGOS.relay, url: 'https://relay.link' },
      { name: 'Ink Official', logo: PLATFORM_LOGOS.inkOfficial, url: 'https://inkonchain.com/bridge' },
      { name: 'Bungee', logo: PLATFORM_LOGOS.bungee, url: 'https://www.bungee.exchange' },
      { name: 'USDT0', logo: PLATFORM_LOGOS.usdt0, url: 'https://usdt0.to' },
    ],
    description: 'Points for bridging assets INTO InkChain',
    formula: 'Tiered: $1-$99 = 25pts, $100-$999 = 100pts, $1K-$5K = 250pts, $5K-$10K = 400pts, $10K+ = 500pts',
    details: [
      'Tier 1: $1-$99 = 25 points (🧳 Tourist)',
      'Tier 2: $100-$999 = 100 points (🧭 Explorer)',
      'Tier 3: $1,000-$4,999 = 250 points (🏗️ Settler)',
      'Tier 4: $5,000-$9,999 = 400 points (🌉 Connector)',
      'Tier 5: $10,000+ = 500 points (🚢 Bridge Whale)',
    ],
    color: 'from-blue-500 to-indigo-500',
    url: 'https://inkonchain.com/bridge',
  },
  {
    name: 'Bridge OUT',
    logos: [
      { name: 'Relay', logo: PLATFORM_LOGOS.relay, url: 'https://relay.link' },
      { name: 'Ink Official', logo: PLATFORM_LOGOS.inkOfficial, url: 'https://inkonchain.com/bridge' },
      { name: 'Bungee', logo: PLATFORM_LOGOS.bungee, url: 'https://www.bungee.exchange' },
      { name: 'USDT0', logo: PLATFORM_LOGOS.usdt0, url: 'https://usdt0.to' },
    ],
    description: 'Points for bridging assets OUT of InkChain',
    formula: 'Tiered: $1-$99 = 25pts, $100-$999 = 100pts, $1K-$5K = 250pts, $5K-$10K = 400pts, $10K+ = 500pts',
    details: [
      'Tier 1: $1-$99 = 25 points (🧳 Tourist)',
      'Tier 2: $100-$999 = 100 points (🧭 Explorer)',
      'Tier 3: $1,000-$4,999 = 250 points (🏗️ Settler)',
      'Tier 4: $5,000-$9,999 = 400 points (🌉 Connector)',
      'Tier 5: $10,000+ = 500 points (🚢 Bridge Whale)',
    ],
    color: 'from-indigo-500 to-purple-500',
    url: 'https://inkonchain.com/bridge',
  },
  {
    name: 'GM',
    logo: PLATFORM_LOGOS.gm,
    description: 'Points for saying GM on InkChain',
    formula: 'Tiered: 1-9 = 50pts, 10-49 = 150pts, 50-149 = 250pts, 150+ = 400pts',
    details: [
      'Tier 1: 1-9 GMs = 50 points (🌅 Waking Up)',
      'Tier 2: 10-49 GMs = 150 points (☕ Coffee Time)',
      'Tier 3: 50-149 GMs = 250 points (📅 Routine)',
      'Tier 4: 150+ GMs = 400 points (🤖 GM Machine)',
    ],
    color: 'from-yellow-500 to-orange-500',
    url: 'https://gm.inkonchain.com',
  },
  {
    name: 'Swap Volume',
    logos: [
      { name: 'InkySwap', logo: PLATFORM_LOGOS.inkyswap, url: 'https://inkyswap.com' },
      { name: 'DyorSwap', logo: PLATFORM_LOGOS.dyorswap, url: 'https://dyorswap.finance' },
      { name: 'Velodrome', logo: PLATFORM_LOGOS.velodrome, url: 'https://velodrome.finance' },
      { name: 'Curve', logo: PLATFORM_LOGOS.curve, url: 'https://curve.fi' },
    ],
    description: 'Points for trading on InkChain DEXes',
    formula: 'Tiered: $1-$999 = 25pts, $1K-$5K = 100pts, $5K-$10K = 250pts, $10K-$25K = 400pts, $25K+ = 500pts',
    details: [
      'Tier 1: $1-$999 = 25 points (🛍️ Shopper)',
      'Tier 2: $1,000-$4,999 = 100 points (🔄 Flipper)',
      'Tier 3: $5,000-$9,999 = 250 points (📈 Active Trader)',
      'Tier 4: $10,000-$24,999 = 400 points (🐋 Swap Whale)',
      'Tier 5: $25,000+ = 500 points (🦄 DEX Master)',
    ],
    color: 'from-green-500 to-teal-500',
    url: 'https://inkyswap.com',
  },
  {
    name: 'Tydro (Lending)',
    logo: PLATFORM_LOGOS.tydro,
    description: 'Points for lending and borrowing on Tydro',
    formula: 'Supply Tiers (max 1,250) + Borrow Tiers (max 1,250) = Max 2,500pts',
    details: [
      'Supply: $1-$99 = 50, $100-$999 = 250, $1K-$10K = 600, $10K-$50K = 1,000, $50K+ = 1,250',
      'Borrow: $1-$49 = 50, $50-$499 = 250, $500-$5K = 600, $5K-$25K = 1,000, $25K+ = 1,250',
      'Both supply and borrow positions earn points independently',
      'Maximum possible: 2,500 points',
    ],
    color: 'from-cyan-500 to-blue-500',
    url: 'https://app.tydro.com',
  },
  {
    name: 'InkyPump',
    logo: PLATFORM_LOGOS.inkypump,
    description: 'Points for creating and trading on InkyPump',
    formula: 'Create Tokens (max 50) + Trading Volume (max 350) = Max 400pts',
    details: [
      'Create: 1 token = 25pts, 3+ tokens = 50pts',
      'Volume: $1-$99 = 50, $100-$999 = 150, $1K-$10K = 250, $10K+ = 350',
      'Maximum possible: 400 points',
    ],
    color: 'from-pink-500 to-rose-500',
    url: 'https://www.inkypump.com',
  },
  {
    name: 'Shellies',
    logo: PLATFORM_LOGOS.shellies,
    description: 'Points for Shellies gaming activities',
    formula: 'Play (max 150) + Stake (max 150) + Raffles (max 100) = Max 400pts',
    details: [
      'Play: 1 game = 25, 10 games = 75, 50+ games = 150',
      'Stake: 1 NFT = 50, 3 NFTs = 100, 5+ NFTs = 150',
      'Raffles: 1 raffle = 25, 5 raffles = 50, 10+ raffles = 100',
      'Maximum possible: 400 points',
    ],
    color: 'from-violet-500 to-purple-500',
    url: 'https://shellies.xyz',
  },
  {
    name: 'ZNS Connect',
    logo: PLATFORM_LOGOS.zns,
    description: 'Points for ZNS domain activities',
    formula: 'Register (max 200) + Deploy (max 50) + GM (max 50) = Max 300pts',
    details: [
      'Register: 1 domain = 100, 3+ domains = 200',
      'Deploy: 1 contract = 20, 3+ contracts = 50',
      'GM: 1 GM = 20, 10+ GMs = 50',
      'Maximum possible: 300 points',
    ],
    color: 'from-blue-500 to-cyan-500',
    url: 'https://zns.bio',
  },
  {
    name: 'NFT2Me',
    logo: PLATFORM_LOGOS.nft2me,
    description: 'Points for NFT creation on NFT2Me',
    formula: 'Collections (max 100) + Mints (max 200) = Max 300pts',
    details: [
      'Collections: 1 = 50, 3+ = 100',
      'Mints: 1 = 50, 10-99 = 100, 100+ = 200',
      'Maximum possible: 300 points',
    ],
    color: 'from-emerald-500 to-green-500',
    url: 'https://nft2me.com',
  },
  {
    name: 'NFT Trading',
    logos: [
      { name: 'Squid Market', logo: PLATFORM_LOGOS.squidMarket, url: 'https://www.squidmarket.xyz' },
      { name: 'Net Protocol', logo: PLATFORM_LOGOS.netProtocol, url: 'https://www.netprotocol.app' },
      { name: 'Mintiq', logo: PLATFORM_LOGOS.mintiq, url: 'https://mintiq.market' },
    ],
    description: 'Points for trading NFTs on marketplaces',
    formula: 'Platforms Used (max 100) + Trade Count (max 300) = Max 400pts',
    details: [
      'Platforms: Squid = 50, Net Protocol = 35, Mintiq = 15 (max 100 for all 3)',
      'Trades: 1 NFT = 50, 5 NFTs = 150, 10+ NFTs = 300',
      'Maximum possible: 400 points',
    ],
    color: 'from-fuchsia-500 to-pink-500',
    url: 'https://www.squidmarket.xyz',
  },
  {
    name: 'Marvk',
    logo: PLATFORM_LOGOS.marvk,
    description: 'Points for Marvk token activities',
    formula: 'Card (max 100) + Lock (max 100) + Vest (max 100) = Max 300pts',
    details: [
      'Card: Mint 1 card = 100 (one-time)',
      'Lock: 1 token = 50, 5+ tokens = 100',
      'Vest: 1 token = 50, 5+ tokens = 100',
      'Maximum possible: 300 points',
    ],
    color: 'from-orange-500 to-amber-500',
    url: 'https://marvk.io',
  },
  {
    name: 'Nado Finance',
    logo: 'https://app.nado.xyz/icon.svg?5705fe91856b2ccd',
    description: 'Points for deposits and trading volume on Nado',
    formula: 'Deposits (max 1,250) + Volume (max 1,250) = Max 2,500pts',
    details: [
      'Deposits: $1-$99 = 50, $100-$999 = 250, $1K-$10K = 600, $10K-$50K = 1,000, $50K+ = 1,250',
      'Volume: $0-$100K = 50, $100K-$500K = 300, $500K-$1M = 550, $1M-$5M = 800, $5M-$10M = 1,000, $10M-$25M = 1,150, $25M+ = 1,250',
      'Maximum possible: 2,500 points',
    ],
    color: 'from-indigo-500 to-blue-500',
    url: 'https://app.nado.xyz',
  },
  {
    name: 'Copink',
    logo: 'https://www.copink.xyz/favicon.ico',
    description: 'Points for subaccounts and trading volume on Copink',
    formula: 'Volume (max 300) + Subaccounts (max 100) = Max 400pts',
    details: [
      'Volume: $1-$999 = 50, $1K-$5K = 150, $5K-$10K = 250, $10K+ = 300',
      'Subaccounts: 1 = 50, 3+ = 100',
      'Maximum possible: 400 points',
    ],
    color: 'from-pink-500 to-fuchsia-500',
    url: 'https://www.copink.xyz',
  },
];

const PlatformCard = ({ platform }: { platform: PlatformRule }) => (
  <div className="glass-card p-4 rounded-xl hover:border-ink-purple/50 transition-all duration-300 group">
    <div className="flex items-start gap-3 mb-3">
      {/* Logo(s) */}
      {platform.logos ? (
        <div className="flex -space-x-2 shrink-0">
          {platform.logos.slice(0, 4).map((p, i) => (
            <a
              key={p.name}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:z-10 transition-transform hover:scale-110"
              title={p.name}
            >
              <img
                src={p.logo}
                alt={p.name}
                className="w-8 h-8 rounded-full object-cover border-2 border-slate-800 bg-slate-800"
                style={{ zIndex: 4 - i }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${p.name.charAt(0)}&background=334155&color=94a3b8&size=32`;
                }}
              />
            </a>
          ))}
        </div>
      ) : platform.logo ? (
        <a
          href={platform.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 hover:scale-110 transition-transform"
          title={platform.name}
        >
          <img
            src={platform.logo}
            alt={platform.name}
            className="w-10 h-10 rounded-full object-cover border-2 border-slate-700 bg-slate-800"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${platform.name.charAt(0)}&background=334155&color=94a3b8&size=40`;
            }}
          />
        </a>
      ) : null}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-white truncate">{platform.name}</h3>
          {platform.url && !platform.logos && (
            <a
              href={platform.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 hover:text-ink-purple transition-colors shrink-0"
            >
              <ExternalLink size={12} />
            </a>
          )}
        </div>
        <p className="text-slate-400 text-xs mt-0.5 line-clamp-2">{platform.description}</p>
      </div>
    </div>

    <div className="bg-slate-900/50 rounded-lg p-2 mb-3 border border-slate-700/50">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Formula</div>
      <div className="text-ink-accent font-mono text-xs">{platform.formula}</div>
    </div>

    <ul className="space-y-1 max-h-[72px] overflow-y-auto custom-scrollbar">
      {platform.details.map((detail, idx) => (
        <li key={idx} className="text-slate-400 text-xs flex items-start gap-1.5">
          <span className="text-ink-purple mt-0.5 shrink-0">•</span>
          <span>{detail}</span>
        </li>
      ))}
    </ul>
  </div>
);

const RankCard = ({ rank, index }: { rank: Rank; index: number }) => (
  <div
    className="glass-card p-4 rounded-xl flex items-center gap-4 hover:border-ink-purple/30 transition-all"
    style={{ animationDelay: `${index * 0.1}s` }}
  >
    <div
      className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0"
      style={{ backgroundColor: rank.color ? `${rank.color}20` : '#1e293b' }}
    >
      {rank.logo_url ? (
        <img src={rank.logo_url} alt={rank.name} className="w-8 h-8" />
      ) : (
        <Award size={24} style={{ color: rank.color || '#a855f7' }} />
      )}
    </div>
    <div className="flex-1">
      <h4 className="font-semibold text-white">{rank.name}</h4>
      <p className="text-sm text-slate-400">
        {rank.min_points.toLocaleString()} - {rank.max_points ? rank.max_points.toLocaleString() : '∞'} points
      </p>
    </div>
    <div
      className="px-3 py-1 rounded-full text-xs font-medium"
      style={{
        backgroundColor: rank.color ? `${rank.color}20` : '#1e293b',
        color: rank.color || '#a855f7'
      }}
    >
      Tier {index + 1}
    </div>
  </div>
);

export default function HowItWorksPage() {
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('overview');

  useEffect(() => {
    const fetchRanks = async () => {
      try {
        const res = await fetch('/api/ranks');
        if (res.ok) {
          const data = await res.json();
          setRanks(data);
        }
      } catch (error) {
        console.error('Failed to fetch ranks:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchRanks();
  }, []);

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['overview', 'wallet-metrics', 'platform-activities', 'rank-tiers', 'score-nft', 'architecture'];
      const scrollPosition = window.scrollY + 150;

      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const offset = 100;
      const elementPosition = element.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: elementPosition - offset, behavior: 'smooth' });
    }
  };

  const navItems = [
    { id: 'overview', label: 'Overview' },
    { id: 'wallet-metrics', label: 'Wallet Metrics', count: nativeMetrics.length },
    { id: 'platform-activities', label: 'Platform Activities', count: platformMetrics.length },
    { id: 'rank-tiers', label: 'Rank Tiers', count: ranks.length },
    { id: 'score-nft', label: 'Score NFT' },
    { id: 'architecture', label: 'Architecture' },
  ];

  return (
    <div className="bg-ink-950 min-h-screen text-slate-200">
      {/* Header */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-ink-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-4">
            <Logo size="sm" />
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>
        </div>
      </nav>

      <div className="pt-20 max-w-7xl mx-auto flex">
        {/* Sidebar Navigation */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24 p-6">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">
              On this page
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between group ${activeSection === item.id
                    ? 'bg-ink-purple/10 text-ink-purple border-l-2 border-ink-purple'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                >
                  <span>{item.label}</span>
                  {item.count !== undefined && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${activeSection === item.id
                      ? 'bg-ink-purple/20 text-ink-purple'
                      : 'bg-slate-700 text-slate-500 group-hover:text-slate-400'
                      }`}>
                      {item.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            {/* Quick Stats */}
            <div className="mt-8 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Quick Stats
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Metrics</span>
                  <span className="text-white font-medium">{nativeMetrics.length + platformMetrics.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Platforms</span>
                  <span className="text-white font-medium">{platformMetrics.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Rank Tiers</span>
                  <span className="text-white font-medium">{ranks.length || '—'}</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 pb-20 px-6 lg:pr-6 lg:pl-0">
          {/* Overview */}
          <section id="overview" className="pt-12 mb-16">
            <h1 className="text-4xl lg:text-5xl font-display font-bold mb-4 text-center">
              How <span className="text-gradient">INKSCORE</span> Works
            </h1>
            <p className="text-slate-400 text-lg mb-8">
              Your INKSCORE is calculated based on your on-chain activity across the InkChain ecosystem.
              Every interaction earns you points that contribute to your total score and rank.
            </p>
          </section>

          {/* Wallet Metrics */}
          <section id="wallet-metrics" className="mb-16">
            <h2 className="text-2xl font-display font-bold mb-2">Wallet Metrics</h2>
            <p className="text-slate-400 mb-8">Points based on your wallet&apos;s holdings and activity</p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {nativeMetrics.map((platform) => (
                <PlatformCard key={platform.name} platform={platform} />
              ))}
            </div>
          </section>

          {/* Platform Activities */}
          <section id="platform-activities" className="mb-16">
            <h2 className="text-2xl font-display font-bold mb-2">Platform Activities</h2>
            <p className="text-slate-400 mb-8">Points earned from interacting with InkChain dApps</p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {platformMetrics.map((platform) => (
                <PlatformCard key={platform.name} platform={platform} />
              ))}
            </div>
          </section>

          {/* Rank Tiers */}
          <section id="rank-tiers" className="mb-16">
            <h2 className="text-2xl font-display font-bold mb-2">Rank Tiers</h2>
            <p className="text-slate-400 mb-8">Your total points determine your rank in the INKSCORE system</p>

            {loading ? (
              <div className="grid md:grid-cols-2 gap-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="glass-card p-4 rounded-xl animate-pulse">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-slate-700"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-slate-700 rounded w-24 mb-2"></div>
                        <div className="h-3 bg-slate-700 rounded w-32"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : ranks.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-4">
                {ranks.map((rank, index) => (
                  <RankCard key={rank.id} rank={rank} index={index} />
                ))}
              </div>
            ) : (
              <div className="glass-card p-8 rounded-xl text-center">
                <p className="text-slate-400">Ranks will be displayed here once configured.</p>
              </div>
            )}
          </section>

          {/* Score NFT */}
          <section id="score-nft" className="mb-16">
            <h2 className="text-2xl font-display font-bold mb-2">Score NFT</h2>
            <p className="text-slate-400 mb-8">Mint an NFT that represents your INKSCORE achievement on-chain</p>

            <div className="grid md:grid-cols-2 gap-6">
              {/* What is Score NFT */}
              <div className="glass-card p-5 rounded-xl">
                <h3 className="text-lg font-semibold text-white mb-3">What is Score NFT?</h3>
                <p className="text-slate-400 text-sm mb-4">
                  The INKSCORE NFT is a dynamic on-chain representation of your wallet&apos;s reputation score. 
                  It displays your current score and rank, and can be updated anytime your score changes.
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="text-slate-400 flex items-start gap-2">
                    <span className="text-ink-purple mt-0.5">•</span>
                    <span>One NFT per wallet - updates replace the old one</span>
                  </li>
                  <li className="text-slate-400 flex items-start gap-2">
                    <span className="text-ink-purple mt-0.5">•</span>
                    <span>Shows your score and rank tier</span>
                  </li>
                  <li className="text-slate-400 flex items-start gap-2">
                    <span className="text-ink-purple mt-0.5">•</span>
                    <span>Free to mint (only gas fees)</span>
                  </li>
                </ul>
              </div>

              {/* How it&apos;s Secured */}
              <div className="glass-card p-5 rounded-xl">
                <h3 className="text-lg font-semibold text-white mb-3">How it&apos;s Secured</h3>
                <p className="text-slate-400 text-sm mb-4">
                  To prevent fake scores, minting requires a cryptographic signature from our backend. 
                  This ensures only verified scores can be minted as NFTs.
                </p>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-ink-purple/20 flex items-center justify-center text-ink-purple text-xs font-bold shrink-0">1</div>
                    <span className="text-slate-400">You request to mint your score</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-ink-purple/20 flex items-center justify-center text-ink-purple text-xs font-bold shrink-0">2</div>
                    <span className="text-slate-400">Backend verifies and signs your score data</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-ink-purple/20 flex items-center justify-center text-ink-purple text-xs font-bold shrink-0">3</div>
                    <span className="text-slate-400">Smart contract validates the signature before minting</span>
                  </div>
                </div>
              </div>

              {/* Contract Info */}
              <div className="glass-card p-5 rounded-xl md:col-span-2">
                <h3 className="text-lg font-semibold text-white mb-3">Contract Details</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Contract Address</div>
                    <div className="flex items-center gap-2">
                      <code className="text-sm text-ink-accent font-mono bg-slate-900/50 px-2 py-1 rounded">
                        0x071E4CBEa9820d2De6Ad53BCb8e2d02ab30238A6
                      </code>
                      <a
                        href="https://explorer.inkonchain.com/address/0x071E4CBEa9820d2De6Ad53BCb8e2d02ab30238A6"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-500 hover:text-ink-purple transition-colors"
                        title="View on Explorer"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Network</div>
                    <div className="text-sm text-white">InkChain Mainnet</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Token Standard</div>
                    <div className="text-sm text-white">ERC-721</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Token Name</div>
                    <div className="text-sm text-white">InkScore Achievement (INKSCORE)</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Architecture */}
          <section id="architecture" className="mb-16">
            <h2 className="text-2xl font-display font-bold mb-2">Architecture</h2>
            <p className="text-slate-400 mb-8">How INKSCORE collects, processes, and serves wallet analytics data</p>

            {/* Architecture Diagram - AWS Style SVG */}
            <div className="glass-card p-6 rounded-xl mb-6 overflow-x-auto">
              <svg viewBox="0 0 900 280" className="w-full min-w-[700px]" xmlns="http://www.w3.org/2000/svg">
                {/* Background */}
                <defs>
                  <linearGradient id="arrowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#475569" />
                    <stop offset="100%" stopColor="#64748b" />
                  </linearGradient>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
                  </marker>
                </defs>

                {/* Data Sources Group */}
                <g transform="translate(20, 40)">
                  <rect x="0" y="0" width="140" height="200" rx="8" fill="#0f172a" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4 2" />
                  <text x="70" y="20" textAnchor="middle" fill="#64748b" fontSize="10" fontWeight="500">DATA SOURCES</text>
                  
                  {/* Ink RPC */}
                  <rect x="20" y="35" width="100" height="45" rx="6" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="1" />
                  <text x="70" y="62" textAnchor="middle" fill="#60a5fa" fontSize="11" fontWeight="500">Ink RPCs</text>
                  
                  {/* Third Party */}
                  <rect x="20" y="90" width="100" height="45" rx="6" fill="#3b1f4a" stroke="#a855f7" strokeWidth="1" />
                  <text x="70" y="117" textAnchor="middle" fill="#c084fc" fontSize="11" fontWeight="500">Third-Party</text>
                  
                  {/* Price Feeds */}
                  <rect x="20" y="145" width="100" height="45" rx="6" fill="#14332a" stroke="#10b981" strokeWidth="1" />
                  <text x="70" y="172" textAnchor="middle" fill="#34d399" fontSize="11" fontWeight="500">Price Feeds</text>
                </g>

                {/* Arrow 1 */}
                <line x1="170" y1="140" x2="220" y2="140" stroke="url(#arrowGrad)" strokeWidth="2" markerEnd="url(#arrowhead)" />

                {/* Indexer */}
                <g transform="translate(230, 80)">
                  <rect x="0" y="0" width="130" height="120" rx="8" fill="#1a1a2e" stroke="#f97316" strokeWidth="1.5" />
                  <rect x="0" y="0" width="130" height="28" rx="8" fill="#f97316" />
                  <rect x="0" y="20" width="130" height="8" fill="#1a1a2e" />
                  <text x="65" y="18" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="600">INDEXER</text>
                  <text x="65" y="50" textAnchor="middle" fill="#94a3b8" fontSize="9">Real-time</text>
                  <text x="65" y="65" textAnchor="middle" fill="#94a3b8" fontSize="9">Block Sync</text>
                  <text x="65" y="85" textAnchor="middle" fill="#94a3b8" fontSize="9">TX Enrichment</text>
                  <text x="65" y="105" textAnchor="middle" fill="#94a3b8" fontSize="9">Metrics Update</text>
                </g>

                {/* Arrow 2 */}
                <line x1="370" y1="140" x2="420" y2="140" stroke="url(#arrowGrad)" strokeWidth="2" markerEnd="url(#arrowhead)" />

                {/* Database */}
                <g transform="translate(430, 80)">
                  <ellipse cx="65" cy="15" rx="55" ry="15" fill="#164e63" stroke="#06b6d4" strokeWidth="1.5" />
                  <rect x="10" y="15" width="110" height="90" fill="#164e63" stroke="#06b6d4" strokeWidth="1.5" />
                  <ellipse cx="65" cy="105" rx="55" ry="15" fill="#164e63" stroke="#06b6d4" strokeWidth="1.5" />
                  <ellipse cx="65" cy="15" rx="55" ry="15" fill="#0e4155" stroke="#06b6d4" strokeWidth="1.5" />
                  <text x="65" y="45" textAnchor="middle" fill="#22d3ee" fontSize="10" fontWeight="600">PostgreSQL</text>
                  <text x="65" y="62" textAnchor="middle" fill="#94a3b8" fontSize="8">Transactions</text>
                  <text x="65" y="75" textAnchor="middle" fill="#94a3b8" fontSize="8">Wallet Stats</text>
                  <text x="65" y="88" textAnchor="middle" fill="#94a3b8" fontSize="8">Cached Scores</text>
                </g>

                {/* Arrow 3 */}
                <line x1="560" y1="140" x2="610" y2="140" stroke="url(#arrowGrad)" strokeWidth="2" markerEnd="url(#arrowhead)" />

                {/* API Server */}
                <g transform="translate(620, 80)">
                  <rect x="0" y="0" width="130" height="120" rx="8" fill="#1a1a2e" stroke="#a855f7" strokeWidth="1.5" />
                  <rect x="0" y="0" width="130" height="28" rx="8" fill="#7c3aed" />
                  <rect x="0" y="20" width="130" height="8" fill="#1a1a2e" />
                  <text x="65" y="18" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="600">API SERVER</text>
                  <text x="65" y="50" textAnchor="middle" fill="#94a3b8" fontSize="9">REST Endpoints</text>
                  <text x="65" y="65" textAnchor="middle" fill="#94a3b8" fontSize="9">Score Calculation</text>
                  <text x="65" y="85" textAnchor="middle" fill="#94a3b8" fontSize="9">NFT Signatures</text>
                  <text x="65" y="105" textAnchor="middle" fill="#94a3b8" fontSize="9">Caching Layer</text>
                </g>

                {/* Arrow 4 - splits to two */}
                <line x1="760" y1="140" x2="800" y2="140" stroke="url(#arrowGrad)" strokeWidth="2" />
                <line x1="800" y1="140" x2="800" y2="70" stroke="url(#arrowGrad)" strokeWidth="2" />
                <line x1="800" y1="140" x2="800" y2="210" stroke="url(#arrowGrad)" strokeWidth="2" />
                <line x1="800" y1="70" x2="830" y2="70" stroke="url(#arrowGrad)" strokeWidth="2" markerEnd="url(#arrowhead)" />
                <line x1="800" y1="210" x2="830" y2="210" stroke="url(#arrowGrad)" strokeWidth="2" markerEnd="url(#arrowhead)" />

                {/* Consumers */}
                <g transform="translate(840, 40)">
                  <rect x="0" y="0" width="50" height="50" rx="6" fill="#1e293b" stroke="#64748b" strokeWidth="1" />
                  <text x="25" y="30" textAnchor="middle" fill="#94a3b8" fontSize="18">🌐</text>
                  <text x="25" y="65" textAnchor="middle" fill="#64748b" fontSize="8">Web App</text>
                </g>
                <g transform="translate(840, 180)">
                  <rect x="0" y="0" width="50" height="50" rx="6" fill="#1e293b" stroke="#64748b" strokeWidth="1" />
                  <text x="25" y="30" textAnchor="middle" fill="#94a3b8" fontSize="18">📜</text>
                  <text x="25" y="65" textAnchor="middle" fill="#64748b" fontSize="8">Contract</text>
                </g>

                {/* Flow Label */}
                <text x="450" y="265" textAnchor="middle" fill="#475569" fontSize="10">Data Flow →</text>
              </svg>
            </div>

          
          </section>

          {/* CTA */}
          <section className="text-center">
            <div className="glass-card p-8 rounded-2xl">
              <h3 className="text-2xl font-display font-bold mb-4">Ready to check your score?</h3>
              <p className="text-slate-400 mb-6">Connect your wallet to see your INKSCORE and start earning points.</p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3 bg-ink-blue hover:bg-blue-600 text-white font-semibold rounded-xl transition-all"
              >
                <Wallet size={20} />
                Connect Wallet
              </Link>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
