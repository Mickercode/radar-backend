// Classifies a content item into Radar's topic slugs via keyword scoring.
// Zero API cost, zero latency. Each category has dedicated keywords that
// minimise cross-category bleed; overlapping terms (e.g. "gospel" appears in
// both music and faith) are deliberately assigned only to the primary category.

const CATEGORY_PROFILES: Record<string, { keywords: string[]; weight: number }> = {
  tech: {
    weight: 1,
    keywords: [
      'technology', 'software', 'artificial intelligence', 'machine learning',
      'cybersecurity', 'cloud computing', 'hardware', 'silicon valley',
      'saas', 'automation', 'robotics', 'data science', 'programming',
      'developer', 'app development', 'gadget', 'smartphone', 'semiconductor',
      'open source', 'algorithm', 'neural network', 'deep learning', 'api',
      'fintech', 'edtech', 'healthtech', 'tech startup', 'venture capital tech',
      'broadband', '5g network', 'telecom tech', 'digital infrastructure',
    ],
  },
  finance: {
    weight: 1,
    keywords: [
      'investing', 'stocks', 'crypto', 'cryptocurrency', 'bitcoin', 'blockchain',
      'trading', 'bonds', 'inflation', 'interest rates', 'retirement fund',
      'budgeting', 'savings', 'financial planning', 'wall street', 'portfolio',
      'naira', 'forex', 'exchange rate', 'capital market', 'nse', 'pension',
      'insurance', 'hedge fund', 'etf', 'ipo', 'equity', 'debt market',
      'fiscal policy', 'monetary policy', 'central bank', 'imf', 'world bank',
      'stock exchange', 'market cap', 'dividend', 'yield', 'credit rating',
    ],
  },
  business: {
    weight: 1,
    keywords: [
      'startup', 'entrepreneur', 'entrepreneurship', 'company', 'industry',
      'leadership', 'management', 'strategy', 'marketing', 'sales revenue',
      'small business', 'corporate', 'productivity', 'business growth',
      'branding', 'negotiation', 'supply chain', 'ceo', 'founder',
      'merger', 'acquisition', 'e-commerce', 'logistics', 'retail',
      'manufacturing', 'trade deal', 'export', 'import', 'b2b', 'b2c',
      'business model', 'franchise', 'private equity',
    ],
  },
  politics: {
    weight: 1,
    keywords: [
      'election', 'government', 'senate', 'president', 'congress',
      'legislation', 'vote', 'campaign', 'democracy', 'parliament',
      'political party', 'diplomacy', 'geopolitics', 'lawmaker', 'referendum',
      'foreign policy', 'governance', 'minister', 'governor', 'constituency',
      'national assembly', 'house of reps', 'tinubu', 'peter obi', 'atiku',
      'political crisis', 'coup', 'sanctions', 'un security council',
      'nato', 'g7', 'g20', 'bilateral', 'treaty', 'statecraft',
    ],
  },
  sports: {
    weight: 1,
    keywords: [
      'football', 'soccer', 'basketball', 'athlete', 'championship',
      'tournament', 'coach', 'olympics', 'match result', 'nba', 'nfl',
      'premier league', 'la liga', 'serie a', 'bundesliga', 'champions league',
      'boxing', 'track and field', 'playoffs', 'world cup', 'super eagles',
      'afcon', 'caf', 'fifa', 'transfer fee', 'goal', 'hat-trick',
      'tennis', 'cricket', 'rugby', 'athletics championship', 'formula 1',
      'wimbledon', 'nba finals', 'sporting event', 'sports injury',
    ],
  },
  health: {
    weight: 1,
    keywords: [
      'wellness', 'mental health', 'nutrition', 'diet plan', 'fitness',
      'exercise routine', 'medicine', 'medical', 'doctor', 'therapy',
      'disease outbreak', 'healthcare', 'self care', 'sleep health',
      'immune system', 'chronic illness', 'public health', 'vaccine',
      'surgery', 'clinical trial', 'nhs', 'hospital', 'patient care',
      'diabetes', 'cancer treatment', 'hiv', 'malaria', 'hypertension',
      'mental illness', 'psychology', 'pharmacology', 'drug approval', 'fda',
    ],
  },
  science: {
    weight: 1,
    keywords: [
      'research study', 'physics', 'biology', 'chemistry', 'space exploration',
      'astronomy', 'scientific discovery', 'experiment', 'scientist',
      'genetics', 'neuroscience', 'quantum computing', 'laboratory',
      'nasa', 'space mission', 'evolution', 'ecosystem', 'paleontology',
      'particle physics', 'stem cell', 'genome', 'rocket launch', 'satellite',
      'mars', 'jwst', 'telescope', 'ocean science', 'earth science',
    ],
  },
  music: {
    weight: 1,
    keywords: [
      'song release', 'album drop', 'music artist', 'concert tour',
      'music genre', 'musician', 'singer', 'band', 'record label',
      'playlist', 'hip hop', 'afrobeats', 'r&b', 'music industry',
      'songwriting', 'music producer', 'music festival', 'grammy',
      'burna boy', 'wizkid', 'davido', 'tiwa savage', 'olamide', 'falz',
      'afropop', 'highlife', 'jùjú music', 'amapiano', 'rap',
      'music video', 'streaming numbers', 'billboard chart', 'music award',
    ],
  },
  film: {
    weight: 1,
    keywords: [
      'movie', 'film', 'cinema', 'nollywood', 'hollywood', 'box office',
      'director', 'actor', 'actress', 'screenplay', 'series', 'netflix',
      'amazon prime', 'hbo', 'disney plus', 'streaming show', 'tv series',
      'documentary', 'animation', 'trailer release', 'film festival',
      'oscars', 'cannes', 'bafta', 'golden globe', 'emmy award',
      'blockbuster', 'indie film', 'sequel', 'prequel', 'reboot',
      'showrunner', 'casting', 'film review', 'critic', 'cinematography',
    ],
  },
  climate: {
    weight: 1,
    keywords: [
      'climate change', 'global warming', 'renewable energy', 'carbon emissions',
      'sustainability', 'conservation', 'biodiversity', 'clean energy',
      'pollution', 'environmental policy', 'green tech', 'ecology',
      'natural disaster', 'flood', 'drought', 'deforestation', 'solar power',
      'wind energy', 'net zero', 'paris agreement', 'cop29', 'cop30',
      'fossil fuels', 'carbon tax', 'electric vehicle', 'green bond',
      'climate finance', 'reforestation', 'carbon capture',
    ],
  },
  faith: {
    weight: 1,
    keywords: [
      'religion', 'church service', 'spirituality', 'sermon', 'christianity',
      'islam', 'bible study', 'prayer meeting', 'worship', 'pastor',
      'religious', 'theology', 'spiritual growth', 'devotional', 'ministry',
      'scripture', 'testimony', 'mosque', 'imam', 'quran', 'eid',
      'christmas', 'easter', 'ramadan', 'pilgrimage', 'evangelism',
      'apostle', 'bishop', 'faith community', 'philosophy of religion',
    ],
  },
  education: {
    weight: 1,
    keywords: [
      'school', 'university', 'teaching', 'student', 'classroom',
      'curriculum', 'academic research', 'tutoring', 'online learning',
      'higher education', 'literacy', 'scholarship', 'teacher',
      'k-12', 'college admission', 'waec', 'jamb', 'neco',
      'student loan', 'campus life', 'graduate school', 'phd', 'degree',
      'learning outcome', 'education reform', 'school funding',
    ],
  },
  fashion: {
    weight: 1,
    keywords: [
      'fashion week', 'runway show', 'fashion designer', 'clothing brand',
      'style trend', 'streetwear', 'couture', 'outfit', 'accessories',
      'apparel', 'model', 'textile', 'sustainable fashion', 'luxury brand',
      'menswear', 'womenswear', 'beauty product', 'skincare', 'makeup',
      'lagos fashion week', 'african print', 'ankara', 'aso-ebi',
      'cosmetics', 'fragrance', 'hair care', 'nail art',
    ],
  },
  travel: {
    weight: 1,
    keywords: [
      'travel destination', 'tourism', 'airline', 'hotel', 'airport',
      'visa', 'tourist attraction', 'adventure travel', 'road trip',
      'beach vacation', 'safari', 'travel guide', 'travel tips',
      'passport', 'luggage', 'itinerary', 'travel ban', 'immigration',
      'diaspora', 'expat', 'digital nomad', 'hostel', 'resort',
    ],
  },
};

/** Fraction of a category's keywords found in text. Range [0, 1]. */
function scoreAgainstCategory(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  let matches = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) matches++;
  }
  return matches / keywords.length;
}

export interface ClassifyOptions {
  /** Score threshold to count as a match. Default raised to 0.08 (~2-3 keyword hits). */
  minConfidence?: number;
  multiLabel?: boolean;
}

export function classifyContent(
  item: { title?: string; description?: string },
  { minConfidence = 0.08, multiLabel = true }: ClassifyOptions = {},
): string[] {
  const text = `${item.title ?? ''} ${item.description ?? ''}`;

  const scored = Object.entries(CATEGORY_PROFILES)
    .map(([slug, { keywords }]) => ({ slug, score: scoreAgainstCategory(text, keywords) }))
    .sort((a, b) => b.score - a.score);

  if (multiLabel) {
    const matches = scored.filter(s => s.score >= minConfidence).map(s => s.slug);
    return matches.length ? matches : ['general'];
  }

  const best = scored[0]!;
  return best.score >= minConfidence ? [best.slug] : ['general'];
}

export function classifyPrimary(item: { title?: string; description?: string }): string {
  return classifyContent(item, { multiLabel: false })[0]!;
}

export { CATEGORY_PROFILES, scoreAgainstCategory };
