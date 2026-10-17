import type { ProfessionModule } from '@/types/curriculum';

export const productOpsModule: ProfessionModule = {
  id: 'pro.product_ops',
  profession: 'product_ops',
  title: 'Python for Product & Operations',
  tagline: 'Connect fragmented tools, automate incident alerts, and track team velocity.',
  audience: 'Product managers, operations leads, scrum masters, and tech program managers.',
  recommendedTier: 'beginner',
  outcomes: [
    'Automate Slack and Jira notifications for high-priority incidents and blockers',
    'Calculate monthly user cohort churn and retention matrices',
    'Collate daily operations metrics and SLA compliance reports',
    'Analyze sprint velocity and estimate release completion dates',
    'Cleanse and normalize messy customer support ticket exports',
  ],
  useCases: [
    {
      id: 'ops-alerts',
      title: 'Automated Jira & Slack Alert Dispatcher',
      problem: 'Critical P0 tickets sit unnoticed in queues for hours before engineers check them.',
      manualProcess: 'Ops lead refreshes ticketing dashboard every 15 minutes and manually pastes links into Slack.',
      roi: { manualMinutes: 60, automatedSeconds: 0.5, frequency: 'daily', annualHoursSaved: 260 },
      packages: [],
      lessonId: 'pro.product_ops.l1-slack-alerts',
      sampleCode: `import json

def format_slack_alert(ticket_id, priority, title, assignee):
    color = "#F85149" if priority == "P0" else "#D29922"
    payload = {
        "text": f"🚨 *{priority} Incident* assigned to @{assignee}",
        "attachments": [
            {
                "color": color,
                "fields": [
                    {"title": "Ticket", "value": ticket_id, "short": True},
                    {"title": "Issue", "value": title, "short": False}
                ]
            }
        ]
    }
    return json.dumps(payload, indent=2)

print(format_slack_alert("PAY-409", "P0", "Stripe webhook 500 error on checkout", "sarah"))`,
    },
    {
      id: 'ops-churn',
      title: 'Cohort Churn & Retention Matrix',
      problem: 'Product leadership needs monthly retention cohorts, but BI dashboards update slowly.',
      manualProcess: 'Export raw user signups and active session logs, construct complex Excel pivot tables.',
      roi: { manualMinutes: 120, automatedSeconds: 2.1, frequency: 'monthly', annualHoursSaved: 24 },
      packages: ['pandas'],
      lessonId: 'pro.product_ops.l2-cohort-churn',
      sampleCode: `import pandas as pd
from io import StringIO

data = """user_id,cohort,month_1,month_2,month_3
U1,2026-01,1,1,1
U2,2026-01,1,1,0
U3,2026-01,1,0,0
U4,2026-02,1,1,1
U5,2026-02,1,0,0"""

df = pd.read_csv(StringIO(data))
cohort_summary = df.groupby("cohort")[["month_1", "month_2", "month_3"]].mean() * 100
print("Retention Rate (%) by Cohort:\\n", cohort_summary.round(1))`,
    },
    {
      id: 'ops-sla',
      title: 'Daily SLA Compliance & Queue Monitoring',
      problem: 'Verifying if support tickets complied with the 2-hour first-response SLA.',
      manualProcess: 'Calculate response duration in minutes per row in Excel, filter > 120 minutes.',
      roi: { manualMinutes: 45, automatedSeconds: 0.8, frequency: 'daily', annualHoursSaved: 195 },
      packages: ['pandas'],
      lessonId: 'pro.product_ops.l3-sla-compliance',
      sampleCode: `import pandas as pd
from io import StringIO

data = """ticket_id,created_min,first_reply_min
TCK-1,0,45
TCK-2,10,140
TCK-3,15,30
TCK-4,20,180"""

df = pd.read_csv(StringIO(data))
df["resp_time"] = df["first_reply_min"] - df["created_min"]
df["sla_breached"] = df["resp_time"] > 120
compliance_pct = (1 - df["sla_breached"].mean()) * 100
print(f"SLA Compliance: {compliance_pct:.1f}%")
print("Breached tickets:\\n", df[df["sla_breached"]])`,
    },
    {
      id: 'ops-velocity',
      title: 'Sprint Velocity Forecasting (Monte Carlo)',
      problem: 'Release planning based on average velocity fails when team size or complexity varies.',
      manualProcess: 'Guess sprint completion dates using standard averages in spreadsheets.',
      roi: { manualMinutes: 90, automatedSeconds: 1.5, frequency: 'weekly', annualHoursSaved: 78 },
      packages: ['numpy'],
      lessonId: 'pro.product_ops.l4-sprint-velocity',
      sampleCode: `import numpy as np

past_sprints = [24, 31, 18, 28, 26, 35, 22] # Story points completed
backlog_remaining = 100

simulations = 1000
sprints_needed = []

for _ in range(simulations):
    pts = 0
    sprints = 0
    while pts < backlog_remaining:
        pts += np.random.choice(past_sprints)
        sprints += 1
    sprints_needed.append(sprints)

p50 = int(np.percentile(sprints_needed, 50))
p90 = int(np.percentile(sprints_needed, 90))
print(f"50% Confidence: {p50} sprints | 90% High-Confidence: {p90} sprints")`,
    },
    {
      id: 'ops-ticket-classifier',
      title: 'Support Ticket Topic Classifier',
      problem: 'Categorizing 500 unclassified user feedback emails into Billing, Bug, or Feature Request.',
      manualProcess: 'Customer support lead manually tags and routes each ticket.',
      roi: { manualMinutes: 180, automatedSeconds: 1.1, frequency: 'weekly', annualHoursSaved: 156 },
      packages: [],
      lessonId: 'pro.product_ops.l5-ticket-classifier',
      sampleCode: `KEYWORDS = {
    "Billing": ["refund", "charge", "card", "invoice", "payment", "cost"],
    "Bug": ["crash", "broken", "error", "blank", "500", "fail"],
    "Feature": ["can you add", "would love", "integrate", "suggestion"],
}

def classify_ticket(subject):
    s = subject.lower()
    for cat, words in KEYWORDS.items():
        if any(w in s for w in words):
            return cat
    return "General"

tickets = ["App crashes when saving project", "Refund for extra charge on mastercard", "Can you add dark mode?"]
for t in tickets:
    print(f"[{classify_ticket(t):<8}] {t}")`,
    },
  ],
};
