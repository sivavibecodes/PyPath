import type { ProfessionModule } from '@/types/curriculum';

/** Marketing & Growth track — each use case maps to a full lesson. */
export const marketingModule: ProfessionModule = {
  id: 'pro.marketing',
  profession: 'marketing',
  title: 'Python for Marketing & Growth',
  tagline: 'Automate the busywork. Trust your attribution.',
  audience: 'Marketing executives, growth marketers, and campaign managers with no coding background.',
  recommendedTier: 'beginner',
  outcomes: [
    'Generate consistent, error-free campaign tracking links at scale',
    'Turn raw analytics CSV exports into weekly summaries automatically',
    'Monitor competitor messaging without manual copy-paste',
    'Score customer reviews by sentiment to spot problems early',
  ],
  useCases: [
    {
      id: 'mkt-utm',
      title: 'Bulk UTM tagging',
      problem: 'Hand-built tracking links are inconsistent and mis-attribute revenue.',
      manualProcess: 'Copy each URL into a spreadsheet formula or Google’s Campaign URL Builder, one by one.',
      roi: { manualMinutes: 90, automatedSeconds: 0.3, frequency: 'per_campaign', annualHoursSaved: 72 },
      packages: [],
      lessonId: 'pro.marketing.l2-utm-autotagger',
      sampleCode: 'from urllib.parse import urlencode\nprint("https://shop.example.com/sale?" + urlencode({"utm_source": "newsletter", "utm_medium": "email"}))',
    },
    {
      id: 'mkt-ga-csv',
      title: 'Analytics CSV → weekly summary',
      problem: 'Every Monday someone pivots the same Google Analytics export by hand.',
      manualProcess: 'Download CSV, build pivot table, copy numbers into a slide.',
      roi: { manualMinutes: 45, automatedSeconds: 2, frequency: 'weekly', annualHoursSaved: 39 },
      packages: ['pandas'],
      lessonId: 'pro.marketing.l3-ga-report',
      sampleCode:
        'import pandas as pd\nfrom io import StringIO\ncsv = "source,sessions,conversions\\ngoogle,1200,48\\nnewsletter,300,27\\nfacebook,900,18"\ndf = pd.read_csv(StringIO(csv))\ndf["cvr_%"] = (df.conversions / df.sessions * 100).round(1)\nprint(df.sort_values("cvr_%", ascending=False).to_string(index=False))',
      sampleFiles: [],
    },
    {
      id: 'mkt-ad-scrape',
      title: 'Competitor ad-copy tracker',
      problem: 'Competitor landing-page headlines change weekly and nobody notices.',
      manualProcess: 'Visit each competitor page and paste headlines into a doc.',
      roi: { manualMinutes: 60, automatedSeconds: 5, frequency: 'weekly', annualHoursSaved: 52 },
      packages: ['beautifulsoup4'],
      lessonId: 'pro.marketing.l4-ad-copy-scraper',
      sampleCode:
        'from bs4 import BeautifulSoup\nhtml = "<h1>Save 30% today</h1><h2>Free returns</h2>"\nsoup = BeautifulSoup(html, "html.parser")\nfor h in soup.find_all(["h1", "h2"]):\n    print(h.get_text())',
    },
    {
      id: 'mkt-sentiment',
      title: 'Review sentiment scoring',
      problem: 'Hundreds of app-store reviews arrive weekly; negative trends surface too late.',
      manualProcess: 'Skim reviews and tag them in a spreadsheet.',
      roi: { manualMinutes: 120, automatedSeconds: 3, frequency: 'weekly', annualHoursSaved: 104 },
      packages: [],
      lessonId: 'pro.marketing.l5-review-sentiment',
      sampleCode:
        'POS = {"love", "great", "fast"}\nNEG = {"slow", "broken", "refund"}\nfor review in ["Love it, great app", "Slow and broken"]:\n    words = set(review.lower().replace(",", "").split())\n    print(len(words & POS) - len(words & NEG), review)',
    },
    {
      id: 'mkt-dedupe-leads',
      title: 'Lead list de-duplication',
      problem: 'Event and webinar lead lists contain duplicates with different capitalisation and whitespace.',
      manualProcess: 'Sort in Excel and eyeball duplicates.',
      roi: { manualMinutes: 40, automatedSeconds: 1, frequency: 'monthly', annualHoursSaved: 8 },
      packages: [],
      lessonId: 'pro.marketing.l6-lead-dedupe',
      sampleCode:
        'emails = ["Ana@Example.com ", "ana@example.com", "bo@site.io"]\nunique = sorted({e.strip().lower() for e in emails})\nprint(unique)',
    },
  ],
};
