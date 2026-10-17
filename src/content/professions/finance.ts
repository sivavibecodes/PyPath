import type { ProfessionModule } from '@/types/curriculum';

export const financeModule: ProfessionModule = {
  id: 'pro.finance',
  profession: 'finance',
  title: 'Python for Finance & Accounting',
  tagline: 'Replace brittle Excel formulas with audit-proof automated pipelines.',
  audience: 'Financial analysts, accountants, auditors, and controllers.',
  recommendedTier: 'beginner',
  outcomes: [
    'Reconcile millions of ledger entries in seconds instead of manual VLOOKUPs',
    'Automate PDF and Excel invoice creation directly from ERP extracts',
    'Calculate DuPont ratios, NPV, IRR, and portfolio volatility deterministically',
    'Fetch real-time and historical FX currency rates for multi-currency conversion',
    'Detect duplicate payments and ledger anomalies using statistical rules',
  ],
  useCases: [
    {
      id: 'fin-reconcile',
      title: 'Ledger Reconciliation in Seconds',
      problem: 'Comparing two 50,000-row bank and internal ledger files crashes Excel and takes 3 hours.',
      manualProcess: 'Copy sheets into one workbook, write INDEX/MATCH or VLOOKUP, filter #N/A, manually check variance.',
      roi: { manualMinutes: 180, automatedSeconds: 1.8, frequency: 'weekly', annualHoursSaved: 154 },
      packages: ['pandas'],
      lessonId: 'pro.finance.l1-ledger-reconcile',
      sampleCode: `import pandas as pd
from io import StringIO

bank_csv = "id,amt\\nTX101,500.00\\nTX102,1250.50\\nTX103,320.00"
erp_csv = "id,amt\\nTX101,500.00\\nTX102,1250.00\\nTX104,90.00"

bank = pd.read_csv(StringIO(bank_csv))
erp = pd.read_csv(StringIO(erp_csv))

merged = pd.merge(bank, erp, on="id", how="outer", suffixes=("_bank", "_erp"))
discrepancies = merged[merged["amt_bank"] != merged["amt_erp"]]
print("Discrepancies found:\\n", discrepancies.fillna(0))`,
    },
    {
      id: 'fin-invoices',
      title: 'Automated Batch Invoicing',
      problem: 'Billing 200 clients each month requires manually duplicating invoice templates.',
      manualProcess: 'Open Word/Excel template, fill name, address, hours, calculate total, export PDF.',
      roi: { manualMinutes: 300, automatedSeconds: 4.5, frequency: 'monthly', annualHoursSaved: 60 },
      packages: [],
      lessonId: 'pro.finance.l2-batch-invoicing',
      sampleCode: `clients = [
    {"name": "Apex Corp", "hours": 42.5, "rate": 150},
    {"name": "Beacon Ltd", "hours": 18.0, "rate": 180},
]

for c in clients:
    subtotal = c["hours"] * c["rate"]
    vat = subtotal * 0.20
    total = subtotal + vat
    print(f"Invoice -> {c['name']:<12} | Net: {subtotal:.2f} | VAT: {vat:.2f} | Total: {total:.2f}")`,
    },
    {
      id: 'fin-fx-scraper',
      title: 'FX Currency Converter & Historical Rates',
      problem: 'Audits require verified central bank currency conversion rates on the specific transaction date.',
      manualProcess: 'Go to central bank website, search date, copy rate into sheet for every foreign transaction.',
      roi: { manualMinutes: 60, automatedSeconds: 2.0, frequency: 'weekly', annualHoursSaved: 50 },
      packages: [],
      lessonId: 'pro.finance.l3-fx-converter',
      sampleCode: `RATES_TO_USD = {"EUR": 1.08, "GBP": 1.28, "JPY": 0.0067, "USD": 1.0}

def convert(amount, from_curr, to_curr="USD"):
    usd_val = amount * RATES_TO_USD[from_curr]
    return round(usd_val / RATES_TO_USD[to_curr], 2)

print("€2,500 in USD:", convert(2500, "EUR", "USD"))
print("£1,400 in EUR:", convert(1400, "GBP", "EUR"))`,
    },
    {
      id: 'fin-dupont',
      title: 'DuPont Financial Ratio Analysis',
      problem: 'Analyzing Return on Equity (ROE) across 15 portfolio companies is prone to formula typos.',
      manualProcess: 'Gather annual reports, hand-calculate Net Profit Margin, Asset Turnover, Financial Leverage.',
      roi: { manualMinutes: 120, automatedSeconds: 1.0, frequency: 'monthly', annualHoursSaved: 24 },
      packages: ['pandas'],
      lessonId: 'pro.finance.l4-dupont-analysis',
      sampleCode: `def dupont_roe(net_income, sales, total_assets, equity):
    net_profit_margin = net_income / sales
    asset_turnover = sales / total_assets
    leverage = total_assets / equity
    roe = net_profit_margin * asset_turnover * leverage
    return {
        "Margin_%": round(net_profit_margin * 100, 2),
        "Asset_Turnover": round(asset_turnover, 2),
        "Leverage": round(leverage, 2),
        "ROE_%": round(roe * 100, 2),
    }

print("Company A DuPont Breakdown:", dupont_roe(150_000, 1_200_000, 800_000, 400_000))`,
    },
    {
      id: 'fin-audit-anomaly',
      title: 'Duplicate Payment & Anomaly Detection',
      problem: 'Vendors occasionally submit duplicate invoices with slightly tweaked invoice numbers.',
      manualProcess: 'Eyeball suspicious vendor payments or run fuzzy matching manually in specialized software.',
      roi: { manualMinutes: 90, automatedSeconds: 1.2, frequency: 'monthly', annualHoursSaved: 18 },
      packages: ['pandas'],
      lessonId: 'pro.finance.l5-audit-anomaly',
      sampleCode: `import pandas as pd
from io import StringIO

data = """vendor,amount,date
Acme Supplies,1450.00,2026-03-01
Acme Supplies,1450.00,2026-03-03
Beta Cleaners,200.00,2026-03-02
Acme Supplies,1450.00,2026-03-01"""

df = pd.read_csv(StringIO(data))
dupes = df[df.duplicated(subset=["vendor", "amount"], keep=False)]
print("Suspected duplicate billings:\\n", dupes)`,
    },
  ],
};
