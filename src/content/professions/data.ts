import type { ProfessionModule } from '@/types/curriculum';

export const dataModule: ProfessionModule = {
  id: 'pro.data',
  profession: 'data',
  title: 'Python for Data Analysts & Scientists',
  tagline: 'Master Pandas, NumPy, statistical modeling, and data storytelling.',
  audience: 'Junior data analysts, business intelligence specialists, researchers, and aspiring data scientists.',
  recommendedTier: 'intermediate',
  outcomes: [
    'Clean dirty, inconsistent tabular datasets with vectorized Pandas operations',
    'Calculate descriptive statistics, correlations, and distribution quantiles',
    'Build simple and multivariate linear regression models from scratch and via stats',
    'Detect outliers using IQR and Z-score methods',
    'Generate clean visual summaries exported directly to publication-ready plots',
  ],
  useCases: [
    {
      id: 'data-cleaning',
      title: 'Vectorized Data Cleaning with Pandas',
      problem: 'Handling missing values, mixed date formats, and corrupted phone numbers across 100k rows.',
      manualProcess: 'Writing complex nested Excel IF formulas or cleaning row-by-row in OpenRefine.',
      roi: { manualMinutes: 150, automatedSeconds: 1.4, frequency: 'weekly', annualHoursSaved: 128 },
      packages: ['pandas'],
      lessonId: 'pro.data.l1-vectorized-cleaning',
      sampleCode: `import pandas as pd
import numpy as np

raw = {
    "age": [25, np.nan, 42, -5, 19],
    "salary": ["$65,000", "$80,000", np.nan, "$45,000", "$52,000"],
    "date": ["2026-01-10", "15/01/2026", "2026-02-01", "invalid", "2026-02-15"]
}
df = pd.DataFrame(raw)
df["salary_clean"] = df["salary"].str.replace("$", "", regex=False).str.replace(",", "", regex=False).astype(float)
df["age_clean"] = df["age"].apply(lambda x: x if x > 0 else np.nan).fillna(df["age"].median())
print("Cleaned Dataset:\\n", df[["age_clean", "salary_clean"]])`,
    },
    {
      id: 'data-outlier',
      title: 'Statistical Outlier Detection (IQR & Z-Score)',
      problem: 'Extreme sensor anomalies or fraudulent spikes distort average sales calculations.',
      manualProcess: 'Manually sorting columns and arbitrarily deleting extreme rows.',
      roi: { manualMinutes: 60, automatedSeconds: 0.6, frequency: 'weekly', annualHoursSaved: 52 },
      packages: ['numpy'],
      lessonId: 'pro.data.l2-outlier-detection',
      sampleCode: `import numpy as np

readings = np.array([12, 14, 15, 13, 14, 16, 12, 95, 14, 13, -40, 15])
q25, q75 = np.percentile(readings, [25, 75])
iqr = q75 - q25
lower_bound = q25 - 1.5 * iqr
upper_bound = q75 + 1.5 * iqr

outliers = readings[(readings < lower_bound) | (readings > upper_bound)]
print(f"IQR: {iqr:.1f} | Bounds: [{lower_bound:.1f}, {upper_bound:.1f}]")
print(f"Detected Outliers: {outliers}")`,
    },
    {
      id: 'data-regression',
      title: 'Bivariate Linear Regression & Correlation',
      problem: 'Estimating the revenue lift associated with increasing marketing budget.',
      manualProcess: 'Using Excel Data Analysis ToolPak or hand-drawing trendlines.',
      roi: { manualMinutes: 90, automatedSeconds: 0.9, frequency: 'monthly', annualHoursSaved: 18 },
      packages: ['numpy'],
      lessonId: 'pro.data.l3-linear-regression',
      sampleCode: `import numpy as np

# Marketing spend ($k) vs New Customers acquired
spend = np.array([10, 15, 20, 25, 30, 35, 40])
customers = np.array([55, 70, 92, 110, 128, 152, 175])

# Compute slope (m) and intercept (b): y = mx + b
m, b = np.polyfit(spend, customers, 1)
r = np.corrcoef(spend, customers)[0, 1]

print(f"Correlation (r): {r:.3f}")
print(f"Model: Customers = {m:.2f} * Spend + {b:.2f}")
print(f"Predicted at $50k spend: {m * 50 + b:.0f} customers")`,
    },
    {
      id: 'data-ab-test',
      title: 'A/B Test Statistical Significance (Z-Test for Proportions)',
      problem: 'Marketing claimed variant B won, but the sample size was too small to be statistically certain.',
      manualProcess: 'Searching online significance calculators and copying numbers back and forth.',
      roi: { manualMinutes: 45, automatedSeconds: 0.4, frequency: 'weekly', annualHoursSaved: 39 },
      packages: ['numpy'],
      lessonId: 'pro.data.l4-ab-testing',
      sampleCode: `import numpy as np
import math

def ab_test_significance(conv_a, n_a, conv_b, n_b):
    p_a = conv_a / n_a
    p_b = conv_b / n_b
    p_pool = (conv_a + conv_b) / (n_a + n_b)
    se = math.sqrt(p_pool * (1 - p_pool) * (1/n_a + 1/n_b))
    z = (p_b - p_a) / se
    significant = abs(z) >= 1.96 # 95% confidence level
    return {
        "Rate_A": f"{p_a * 100:.2f}%",
        "Rate_B": f"{p_b * 100:.2f}%",
        "Z_Score": round(z, 2),
        "Significant_95%": significant
    }

print("A/B Landing Page Test:", ab_test_significance(140, 2000, 195, 2050))`,
    },
    {
      id: 'data-rfm',
      title: 'Customer Segmentation via RFM Scoring',
      problem: 'Marketing needs to separate Champions from At-Risk customers based on transaction history.',
      manualProcess: 'Writing multi-sheet conditional formulas with percentiles in Excel.',
      roi: { manualMinutes: 180, automatedSeconds: 1.8, frequency: 'monthly', annualHoursSaved: 36 },
      packages: ['pandas'],
      lessonId: 'pro.data.l5-rfm-segmentation',
      sampleCode: `import pandas as pd
from io import StringIO

data = """customer,recency_days,orders,total_spend
C101,5,14,3200
C102,120,2,150
C103,12,8,1250
C104,240,1,60
C105,8,22,5400"""

df = pd.read_csv(StringIO(data))
df["R_Score"] = pd.qcut(df["recency_days"].rank(method="first", ascending=False), q=3, labels=[1, 2, 3])
df["M_Score"] = pd.qcut(df["total_spend"].rank(method="first"), q=3, labels=[1, 2, 3])
print(df[["customer", "recency_days", "total_spend", "R_Score", "M_Score"]])`,
    },
  ],
};
