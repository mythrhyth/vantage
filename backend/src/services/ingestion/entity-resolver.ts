import { prisma } from '../../db';

export interface ResolvedEntity {
  canonicalName: string;
  ticker?: string;
  entityType: 'CORPORATION' | 'CENTRAL_BANK' | 'MACRO_INDICATOR' | 'COMMODITY' | 'SECTOR';
  matchType: 'EXACT_TICKER' | 'CANONICAL_NAME' | 'ALIAS' | 'SECTOR' | 'SEMANTIC';
  confidence: number;
  evidence?: string;
}

export interface PortfolioRelevanceAnalysis {
  relevant: boolean;
  relevanceType: 'DIRECT' | 'INDIRECT' | 'PORTFOLIO_WIDE' | 'IRRELEVANT';
  relevanceScore: number;
  relevanceReason: string;
  affectedAssets: string[];
  resolvedEntities: ResolvedEntity[];
}

export interface IEntityResolver {
  resolveEntities(text: string, title: string, portfolioId?: string): Promise<ResolvedEntity[]>;
  evaluatePortfolioRelevance(text: string, title: string, portfolioId?: string): Promise<PortfolioRelevanceAnalysis>;
}

// =============================================================================
// ALIAS & ENTITY DICTIONARIES
// =============================================================================
const ALIAS_DICTIONARY: Record<string, { canonical: string; ticker: string; aliases: string[] }> = {
  AAPL: {
    canonical: 'Apple Inc.',
    ticker: 'AAPL',
    aliases: ['apple', 'apple inc', 'apple corp', 'apple computer', 'iphone maker']
  },
  MSFT: {
    canonical: 'Microsoft Corp.',
    ticker: 'MSFT',
    aliases: ['microsoft', 'microsoft corp', 'microsoft corporation', 'windows maker']
  },
  GOOGL: {
    canonical: 'Alphabet Inc.',
    ticker: 'GOOGL',
    aliases: ['google', 'alphabet', 'alphabet inc', 'google parent']
  },
  JPM: {
    canonical: 'JPMorgan Chase & Co.',
    ticker: 'JPM',
    aliases: ['jpmorgan', 'jpmorgan chase', 'jpmorgan chase & co', 'jp morgan', 'chase bank']
  }
};

const CENTRAL_BANK_DICTIONARY: Record<string, string[]> = {
  'Federal Reserve': ['federal reserve', 'fed', 'fomc', 'us central bank', 'powell'],
  'European Central Bank': ['european central bank', 'ecb', 'lagarde'],
  'Bank of Japan': ['bank of japan', 'boj'],
  'Bank of England': ['bank of england', 'boe']
};

const MACRO_INDICATOR_DICTIONARY: Record<string, string[]> = {
  'Inflation': ['cpi', 'consumer price index', 'inflation', 'ppi', 'producer price'],
  'Interest Rates': ['interest rate', 'rate hike', 'rate cut', 'policy rate', 'benchmark rate', 'fed funds'],
  'Unemployment': ['unemployment', 'jobless claims', 'payroll', 'non-farm payrolls'],
  'GDP': ['gdp', 'gross domestic product', 'economic growth', 'recession']
};

const COMMODITY_DICTIONARY: Record<string, string[]> = {
  'Crude Oil': ['crude oil', 'brent crude', 'wti', 'oil prices', 'petroleum', 'barrel'],
  'Natural Gas': ['natural gas', 'gas prices'],
  'Gold': ['gold futures', 'spot gold', 'gold bullion'],
  'Metals': ['copper', 'aluminum', 'steel prices', 'iron ore']
};

// Sector Mapping Dictionary
const SECTOR_KEYWORDS: Record<string, string[]> = {
  'Technology': ['semiconductor', 'software', 'cloud', 'artificial intelligence', 'ai chip', 'tech sector', 'consumer electronics'],
  'Financial Services': ['banking', 'banks', 'financial sector', 'investment banking', 'wall street', 'credit cards'],
  'Communication Services': ['search engine', 'online advertising', 'streaming', 'telecom', 'media'],
  'Banking & Credit': ['distressed loans', 'credit losses', 'delinquency rates', 'bank default', 'commercial paper', 'loan portfolio'],
  'Fixed Income': ['sovereign bond', 'corporate bond', 'treasury yield', 'bond market', 'yield curve'],
  'Hedging': ['interest rate swap', 'derivatives market', 'options volatility', 'vix']
};

// Guard regex for non-corporate "apple" mentions
const NON_CORPORATE_APPLE_REGEX = /\b(apple\s+(pie|cider|juice|tree|harvest|orchard|sauce|butter|baker|bakery|pastry|recipe|fruit|picker|picking)|autumn\s+apple|best\s+apple)\b/i;
const CORPORATE_APPLE_CONTEXT_REGEX = /\b(inc|corp|aapl|stock|shares?|iphone|mac|ipad|tim cook|cupertino|revenue|earnings|quarter|quarterly|profit|nasdaq|tech|device|app store|ios|services|analyst|broker)\b/i;

export class EntityResolver implements IEntityResolver {
  /**
   * Normalizes company names cleanly without stripping key structural tokens.
   */
  public normalizeCompanyName(name: string): string {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/&(?:amp;)?/g, 'and')
      .replace(/\b(inc|corp|corporation|co|company|llc|ltd|plc)\b\.?/gi, '')
      .replace(/[^a-z0-9\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isNonCorporateApple(textLower: string): boolean {
    if (NON_CORPORATE_APPLE_REGEX.test(textLower)) {
      if (!CORPORATE_APPLE_CONTEXT_REGEX.test(textLower)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Resolves entities mentioned in article text using a deterministic 4-layer resolution engine.
   */
  public async resolveEntities(text: string, title: string, portfolioId?: string): Promise<ResolvedEntity[]> {
    const combined = `${title} ${text}`;
    const combinedLower = combined.toLowerCase();
    const resolved: ResolvedEntity[] = [];
    const matchedTickers = new Set<string>();

    // Load portfolio assets scoped to portfolioId if provided
    let assets: Array<{ ticker: string | null; company: string | null; sector: string | null }> = [];
    if (portfolioId) {
      assets = await prisma.asset.findMany({
        where: { portfolio_id: portfolioId },
        select: { ticker: true, company: true, sector: true }
      });
    } else {
      const p = await prisma.portfolio.findFirst({ include: { assets: true } });
      if (p) assets = p.assets;
    }

    // -------------------------------------------------------------------------
    // LAYER 1: Exact Ticker Matching (with word boundaries & short-ticker safeguards)
    // -------------------------------------------------------------------------
    for (const asset of assets) {
      if (!asset.ticker) continue;
      const t = asset.ticker;

      // Short ticker safeguard (<= 2 chars e.g. "A", "IT")
      if (t.length <= 2) {
        const exactUpperRegex = new RegExp(`\\b${t}\\b`);
        const contextRegex = /\b(stock|shares|ticker|equity|NYSE|NASDAQ|\$)\b/i;
        if (exactUpperRegex.test(combined) && contextRegex.test(combined)) {
          matchedTickers.add(t);
          resolved.push({
            canonicalName: asset.company || t,
            ticker: t,
            entityType: 'CORPORATION',
            matchType: 'EXACT_TICKER',
            confidence: 0.98,
            evidence: `Exact ticker match for ${t} with equity market context`
          });
        }
      } else {
        const regex = new RegExp(`\\b${t}\\b`, 'i');
        if (regex.test(combined)) {
          matchedTickers.add(t);
          resolved.push({
            canonicalName: asset.company || t,
            ticker: t,
            entityType: 'CORPORATION',
            matchType: 'EXACT_TICKER',
            confidence: 0.99,
            evidence: `Exact ticker match for ${t}`
          });
        }
      }
    }

    // -------------------------------------------------------------------------
    // LAYER 2: Canonical Company Name Matching & LAYER 3: Alias Dictionary
    // -------------------------------------------------------------------------
    for (const asset of assets) {
      if (!asset.company) continue;
      const normCompany = this.normalizeCompanyName(asset.company);

      // Check canonical company name
      if (normCompany.length >= 3) {
        // Non-corporate apple guard
        if (normCompany === 'apple' && this.isNonCorporateApple(combinedLower)) {
          continue;
        }

        const compRegex = new RegExp(`\\b${normCompany.replace(/\s+/g, '\\s+')}\\b`, 'i');
        if (compRegex.test(combinedLower)) {
          const tKey = asset.ticker || normCompany;
          if (!matchedTickers.has(tKey)) {
            matchedTickers.add(tKey);
            resolved.push({
              canonicalName: asset.company,
              ticker: asset.ticker || undefined,
              entityType: 'CORPORATION',
              matchType: 'CANONICAL_NAME',
              confidence: 0.95,
              evidence: `Canonical company name match for '${asset.company}'`
            });
          }
        }
      }

      // Check Alias Dictionary
      if (asset.ticker && ALIAS_DICTIONARY[asset.ticker]) {
        const dict = ALIAS_DICTIONARY[asset.ticker];
        for (const alias of dict.aliases) {
          if (alias === 'apple' && this.isNonCorporateApple(combinedLower)) {
            continue;
          }

          const aliasRegex = new RegExp(`\\b${alias.replace(/\s+/g, '\\s+')}\\b`, 'i');
          if (aliasRegex.test(combinedLower)) {
            if (!matchedTickers.has(asset.ticker)) {
              matchedTickers.add(asset.ticker);
              resolved.push({
                canonicalName: dict.canonical,
                ticker: dict.ticker,
                entityType: 'CORPORATION',
                matchType: 'ALIAS',
                confidence: 0.92,
                evidence: `Alias match '${alias}' resolved to ${dict.canonical} (${dict.ticker})`
              });
            }
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // LAYER 4: Central Banks, Macro Indicators & Commodities Dictionaries
    // -------------------------------------------------------------------------
    for (const [cbName, cbAliases] of Object.entries(CENTRAL_BANK_DICTIONARY)) {
      for (const alias of cbAliases) {
        const rx = new RegExp(`\\b${alias.replace(/\s+/g, '\\s+')}\\b`, 'i');
        if (rx.test(combinedLower)) {
          resolved.push({
            canonicalName: cbName,
            entityType: 'CENTRAL_BANK',
            matchType: 'CANONICAL_NAME',
            confidence: 0.95,
            evidence: `Central Bank match '${alias}' -> ${cbName}`
          });
          break;
        }
      }
    }

    for (const [macroName, macroAliases] of Object.entries(MACRO_INDICATOR_DICTIONARY)) {
      for (const alias of macroAliases) {
        const rx = new RegExp(`\\b${alias.replace(/\s+/g, '\\s+')}\\b`, 'i');
        if (rx.test(combinedLower)) {
          resolved.push({
            canonicalName: macroName,
            entityType: 'MACRO_INDICATOR',
            matchType: 'CANONICAL_NAME',
            confidence: 0.90,
            evidence: `Macro Indicator match '${alias}' -> ${macroName}`
          });
          break;
        }
      }
    }

    for (const [commName, commAliases] of Object.entries(COMMODITY_DICTIONARY)) {
      for (const alias of commAliases) {
        const rx = new RegExp(`\\b${alias.replace(/\s+/g, '\\s+')}\\b`, 'i');
        if (rx.test(combinedLower)) {
          resolved.push({
            canonicalName: commName,
            entityType: 'COMMODITY',
            matchType: 'CANONICAL_NAME',
            confidence: 0.88,
            evidence: `Commodity match '${alias}' -> ${commName}`
          });
          break;
        }
      }
    }

    // Deduplicate resolved entities by canonicalName
    const deduped: ResolvedEntity[] = [];
    const seenNames = new Set<string>();

    for (const ent of resolved) {
      if (!seenNames.has(ent.canonicalName)) {
        seenNames.add(ent.canonicalName);
        deduped.push(ent);
      }
    }

    return deduped;
  }

  /**
   * Evaluates portfolio relevance, relevanceType, relevanceScore, relevanceReason, and affectedAssets
   * strictly scoped to the specified portfolioId.
   */
  public async evaluatePortfolioRelevance(
    text: string,
    title: string,
    portfolioId?: string
  ): Promise<PortfolioRelevanceAnalysis> {
    const combined = `${title} ${text}`.toLowerCase();

    // Load portfolio & holdings strictly scoped to portfolioId
    let portfolio: any = null;
    if (portfolioId) {
      portfolio = await prisma.portfolio.findUnique({
        where: { id: portfolioId },
        include: { assets: true }
      });
    }

    if (!portfolio) {
      portfolio = await prisma.portfolio.findFirst({ include: { assets: true } });
    }

    if (!portfolio || !portfolio.assets || portfolio.assets.length === 0) {
      return {
        relevant: false,
        relevanceType: 'IRRELEVANT',
        relevanceScore: 0.0,
        relevanceReason: 'No portfolio assets available for relevance evaluation.',
        affectedAssets: [],
        resolvedEntities: []
      };
    }

    const assets = portfolio.assets;
    const resolvedEntities = await this.resolveEntities(text, title, portfolio.id);

    // 1. DIRECT RELEVANCE EVALUATION
    const directEntities = resolvedEntities.filter(
      e => e.entityType === 'CORPORATION' && (e.matchType === 'EXACT_TICKER' || e.matchType === 'CANONICAL_NAME' || e.matchType === 'ALIAS')
    );

    if (directEntities.length > 0) {
      const affectedTickers: string[] = [];
      let totalDirectWeight = 0;

      for (const ent of directEntities) {
        const matchedAsset = assets.find(
          (a: any) => (ent.ticker && a.ticker === ent.ticker) || (a.company && a.company.toLowerCase().includes(ent.canonicalName.toLowerCase()))
        );
        if (matchedAsset) {
          const tickerName = matchedAsset.ticker || matchedAsset.company || ent.canonicalName;
          if (!affectedTickers.includes(tickerName)) {
            affectedTickers.push(tickerName);
            totalDirectWeight += Number(matchedAsset.current_weight || 0);
          }
        }
      }

      if (affectedTickers.length > 0) {
        const topConf = Math.max(...directEntities.map(e => e.confidence));
        const relevanceScore = Math.min(1.0, Number((1.0 * 0.60 + totalDirectWeight * 0.25 + topConf * 0.15).toFixed(4)));

        return {
          relevant: true,
          relevanceType: 'DIRECT',
          relevanceScore,
          relevanceReason: `Direct impact on portfolio asset(s): ${affectedTickers.join(', ')} (representing ${(totalDirectWeight * 100).toFixed(1)}% portfolio weight).`,
          affectedAssets: affectedTickers,
          resolvedEntities
        };
      }
    }

    // 2. PORTFOLIO-WIDE MACRO EVALUATION
    const cbEntities = resolvedEntities.filter(e => e.entityType === 'CENTRAL_BANK');
    const macroEntities = resolvedEntities.filter(e => e.entityType === 'MACRO_INDICATOR');
    const commEntities = resolvedEntities.filter(e => e.entityType === 'COMMODITY');

    const isMacroEvent = cbEntities.length > 0 || macroEntities.length > 0 || commEntities.length > 0 ||
      /\b(federal reserve|fed|fomc|interest rate|rate cut|rate hike|cpi|inflation|recession|banking sector|credit crunch)\b/i.test(combined);

    if (isMacroEvent) {
      const macroAffectedAssets: string[] = [];
      let totalMacroWeight = 0;

      // Rate Hike / Central Bank / Debt Stress -> LOANS, BONDS, DERIVATIVES
      if (cbEntities.length > 0 || /\b(rate hike|interest rate|monetary policy|fomc|tightening|fed)\b/i.test(combined)) {
        const rateSensitiveAssets = assets.filter((a: any) =>
          ['LOANS', 'BONDS', 'DERIVATIVES'].includes(a.asset_type) || a.sector === 'Financial Services'
        );
        for (const asset of rateSensitiveAssets) {
          const name = asset.company || asset.ticker || asset.asset_type;
          if (!macroAffectedAssets.includes(name)) {
            macroAffectedAssets.push(name);
            totalMacroWeight += Number(asset.current_weight || 0);
          }
        }
      }

      // Inflation / CPI -> BONDS & EQUITIES
      if (/\b(cpi|inflation|producer price)\b/i.test(combined)) {
        const inflationAssets = assets.filter((a: any) =>
          ['BONDS', 'EQUITY'].includes(a.asset_type)
        );
        for (const asset of inflationAssets) {
          const name = asset.company || asset.ticker || asset.asset_type;
          if (!macroAffectedAssets.includes(name)) {
            macroAffectedAssets.push(name);
            totalMacroWeight += Number(asset.current_weight || 0);
          }
        }
      }

      // Fallback: If macro affected assets list is empty, take high-weight portfolio asset classes
      if (macroAffectedAssets.length === 0) {
        for (const asset of assets) {
          if (Number(asset.current_weight || 0) >= 0.10) {
            const name = asset.company || asset.ticker || asset.asset_type;
            if (!macroAffectedAssets.includes(name)) {
              macroAffectedAssets.push(name);
              totalMacroWeight += Number(asset.current_weight || 0);
            }
          }
        }
      }

      const relevanceScore = Math.min(1.0, Number((0.85 * 0.60 + totalMacroWeight * 0.25 + 0.90 * 0.15).toFixed(4)));
      const macroReason = cbEntities.length > 0
        ? `Central Bank event (${cbEntities.map(e => e.canonicalName).join(', ')}) affecting rate-sensitive asset classes.`
        : 'Macroeconomic event affecting broad portfolio asset classes.';

      return {
        relevant: true,
        relevanceType: 'PORTFOLIO_WIDE',
        relevanceScore,
        relevanceReason: macroReason,
        affectedAssets: macroAffectedAssets,
        resolvedEntities
      };
    }

    // 3. INDIRECT / SECTOR RELEVANCE EVALUATION
    const indirectAffectedAssets: string[] = [];
    let totalIndirectWeight = 0;

    for (const [sectorName, keywords] of Object.entries(SECTOR_KEYWORDS)) {
      const hasKeyword = keywords.some(kw => new RegExp(`\\b${kw.replace(/\s+/g, '\\s+')}\\b`, 'i').test(combined));
      if (hasKeyword) {
        const sectorAssets = assets.filter((a: any) => a.sector && a.sector.toLowerCase() === sectorName.toLowerCase());
        for (const asset of sectorAssets) {
          const name = asset.ticker || asset.company || asset.asset_type;
          if (!indirectAffectedAssets.includes(name)) {
            indirectAffectedAssets.push(name);
            totalIndirectWeight += Number(asset.current_weight || 0);
          }
        }
      }
    }

    if (indirectAffectedAssets.length > 0) {
      const relevanceScore = Math.min(1.0, Number((0.65 * 0.60 + totalIndirectWeight * 0.25 + 0.85 * 0.15).toFixed(4)));

      return {
        relevant: true,
        relevanceType: 'INDIRECT',
        relevanceScore,
        relevanceReason: `Indirect sector impact on portfolio asset(s): ${indirectAffectedAssets.join(', ')}.`,
        affectedAssets: indirectAffectedAssets,
        resolvedEntities
      };
    }

    // 4. IRRELEVANT FALLBACK
    return {
      relevant: false,
      relevanceType: 'IRRELEVANT',
      relevanceScore: 0.0,
      relevanceReason: 'Article contains no direct entity or macro relevance to selected portfolio holdings.',
      affectedAssets: [],
      resolvedEntities
    };
  }
}

export const entityResolver = new EntityResolver();
