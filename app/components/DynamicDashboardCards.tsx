"use client";

import React, { useState, useRef, useEffect } from 'react';
import { DashboardCardData } from '@/lib/types/dashboard';
import { getProxiedImageUrl, getFallbackAvatarUrl } from '@/lib/utils/imageProxy';

const COLOR_CLASSES: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  purple: {
    border: 'border-purple-500/20',
    bg: 'bg-purple-500/5',
    text: 'text-purple-400',
    badge: 'bg-purple-900/30 border-purple-500/30 text-purple-400',
  },
  cyan: {
    border: 'border-cyan-500/20',
    bg: 'bg-cyan-500/5',
    text: 'text-cyan-400',
    badge: 'bg-cyan-900/30 border-cyan-500/30 text-cyan-400',
  },
  yellow: {
    border: 'border-yellow-500/20',
    bg: 'bg-yellow-500/5',
    text: 'text-yellow-400',
    badge: 'bg-yellow-900/30 border-yellow-500/30 text-yellow-400',
  },
  pink: {
    border: 'border-pink-500/20',
    bg: 'bg-pink-500/5',
    text: 'text-pink-400',
    badge: 'bg-pink-900/30 border-pink-500/30 text-pink-400',
  },
  emerald: {
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/5',
    text: 'text-emerald-400',
    badge: 'bg-emerald-900/30 border-emerald-500/30 text-emerald-400',
  },
  blue: {
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/5',
    text: 'text-blue-400',
    badge: 'bg-blue-900/30 border-blue-500/30 text-blue-400',
  },
  orange: {
    border: 'border-orange-500/20',
    bg: 'bg-orange-500/5',
    text: 'text-orange-400',
    badge: 'bg-orange-900/30 border-orange-500/30 text-orange-400',
  },
};

export const getColorClasses = (color: string) => {
  return COLOR_CLASSES[color] || COLOR_CLASSES.purple;
};

// Carousel for additional Row 3 cards (large cards)
export function DynamicCardsCarouselRow3({ cards }: { cards: DashboardCardData[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [cards]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (cards.length === 0) return null;

  return (
    <div className="relative group">
      {/* Left Arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-slate-800/90 hover:bg-slate-700 rounded-full flex items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 -translate-x-1/2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Scrollable Container */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {cards.map((card, index) => (
          <div key={card.id} className="flex-shrink-0 w-[calc(50%-12px)] min-w-[320px] snap-start">
            <DashboardCardLarge card={card} delay={index * 0.05} />
          </div>
        ))}
      </div>

      {/* Right Arrow */}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-slate-800/90 hover:bg-slate-700 rounded-full flex items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 translate-x-1/2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}

// Carousel for additional Row 4 cards (small cards)
export function DynamicCardsCarouselRow4({ cards }: { cards: DashboardCardData[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [cards]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  if (cards.length === 0) return null;

  return (
    <div className="relative group">
      {/* Left Arrow */}
      {canScrollLeft && (
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-slate-800/90 hover:bg-slate-700 rounded-full flex items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 -translate-x-1/2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Scrollable Container */}
      <div
        ref={scrollRef}
        onScroll={checkScroll}
        className="flex gap-6 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {cards.map((card, index) => (
          <div key={card.id} className="flex-shrink-0 w-[calc(33.333%-16px)] min-w-[280px] snap-start">
            <SmallDashboardCard card={card} delay={index * 0.05} />
          </div>
        ))}
      </div>

      {/* Right Arrow */}
      {canScrollRight && (
        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 bg-slate-800/90 hover:bg-slate-700 rounded-full flex items-center justify-center shadow-lg transition-all opacity-0 group-hover:opacity-100 translate-x-1/2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  );
}

// Large Dashboard Card Component (for Row 3)
export function DashboardCardLarge({ card, delay }: { card: DashboardCardData; delay: number }) {
  const colors = getColorClasses(card.color);
  const currency = card.metrics[0]?.metric.currency || 'USD';

  return (
    <div
      className={`glass-card p-6 rounded-2xl animate-fade-in-up border ${colors.border} ${colors.bg} h-[300px] flex flex-col`}
      style={{ animationDelay: `${0.6 + delay}s` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          {/* Platform Logos */}
          {card.platforms.length > 0 && (
            <div className="flex items-center -space-x-3">
              {card.platforms.slice(0, 3).map((p, i) => (
                <img
                  key={p.platform_id}
                  src={getProxiedImageUrl(p.platform.logo_url) || getFallbackAvatarUrl(p.platform.name, 28)}
                  alt={p.platform.name}
                  className={`w-7 h-7 rounded-full object-cover border-2 ${colors.border.replace('/20', '')} bg-slate-800`}
                  style={{ zIndex: 3 - i }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = getFallbackAvatarUrl(p.platform.name, 28);
                  }}
                />
              ))}
              {card.platforms.length > 3 && (
                <div className="w-7 h-7 rounded-full bg-slate-700 border-2 border-slate-600 flex items-center justify-center text-xs text-slate-400">
                  +{card.platforms.length - 3}
                </div>
              )}
            </div>
          )}
          {card.title}
        </h3>
        <div className={`text-xs font-bold px-2 py-1 rounded border ${colors.badge}`}>
          {currency}
        </div>
      </div>

      {/* Main Values */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className={`text-3xl font-bold font-display ${colors.text}`}>
            {currency === 'COUNT' 
              ? card.totalCount.toLocaleString()
              : `$${card.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            }
          </div>
          {card.subtitle && (
            <div className="text-xs text-slate-500">{card.subtitle}</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold font-display text-white">
            {card.totalCount.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500">Transactions</div>
        </div>
      </div>

      {/* Platform Breakdown */}
      {card.byPlatform.length > 0 && (
        <div className="flex-1 pt-3 border-t border-slate-700/50 flex flex-col min-h-0">
          <span className="text-xs text-slate-500 uppercase tracking-wider mb-2">By Platform</span>
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar max-h-[140px]">
            {card.byPlatform.map((platform, i) => (
              <div key={i} className="flex justify-between items-center text-xs py-0.5">
                <span className="text-slate-400 flex items-center gap-1.5">
                  {platform.platform.logo_url && (
                    <img
                      src={getProxiedImageUrl(platform.platform.logo_url)}
                      alt={platform.platform.name}
                      className="w-3.5 h-3.5 rounded"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  )}
                  {platform.platform.name}
                </span>
                <div className="text-right">
                  <span className="font-mono text-white text-xs">
                    {currency === 'COUNT'
                      ? platform.count.toLocaleString()
                      : `$${platform.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    }
                  </span>
                  <span className="text-slate-500 text-[10px] ml-1.5">
                    ({platform.count})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Indicator */}
      {card.totalCount > 0 && (
        <div className={`mt-3 text-xs ${colors.text} opacity-80 flex items-center gap-1`}>
          <span className={`w-1.5 h-1.5 rounded-full ${colors.text.replace('text-', 'bg-')} animate-pulse`}></span>
          Active
        </div>
      )}
    </div>
  );
}

// Smaller card for Row 4
export function SmallDashboardCard({ card, delay }: { card: DashboardCardData; delay: number }) {
  const colors = getColorClasses(card.color);
  const currency = card.metrics[0]?.metric.currency || 'USD';
  const platform = card.platforms[0]?.platform;

  return (
    <div
      className={`glass-card p-6 rounded-xl animate-fade-in-up border ${colors.border} ${colors.bg} h-[200px] flex flex-col`}
      style={{ animationDelay: `${0.6 + delay}s` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          {platform?.logo_url && (
            <img
              src={getProxiedImageUrl(platform.logo_url)}
              alt={platform.name}
              className="w-6 h-6 rounded"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          )}
          {card.title}
        </h3>
        <div className={`text-xs font-bold px-2 py-1 rounded border ${colors.badge}`}>
          {currency}
        </div>
      </div>

      {/* Values */}
      <div className="flex items-center justify-between flex-1">
        <div>
          <div className={`text-2xl font-bold font-display ${colors.text}`}>
            {currency === 'COUNT'
              ? card.totalCount.toLocaleString()
              : `$${card.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            }
          </div>
          {card.subtitle && (
            <div className="text-xs text-slate-500">{card.subtitle}</div>
          )}
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold font-display text-white">
            {card.totalCount.toLocaleString()}
          </div>
          <div className="text-xs text-slate-500">Transactions</div>
        </div>
      </div>

      {/* Active Indicator */}
      {card.totalCount > 0 && (
        <div className={`mt-auto text-xs ${colors.text} opacity-80 flex items-center gap-1`}>
          <span className={`w-1.5 h-1.5 rounded-full ${colors.text.replace('text-', 'bg-')} animate-pulse`}></span>
          Active
        </div>
      )}
    </div>
  );
}

// Legacy exports for backwards compatibility
export function DynamicDashboardCardsRow3({ cards }: { cards: DashboardCardData[] }) {
  return <DynamicCardsCarouselRow3 cards={cards} />;
}

export function DynamicDashboardCardsRow4({ cards }: { cards: DashboardCardData[] }) {
  return <DynamicCardsCarouselRow4 cards={cards} />;
}
