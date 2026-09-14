# Acme Cloud — Customer FAQ (internal knowledge base, v3.2)

## Company

Acme Cloud is a fictional infrastructure provider founded in 2019 in Tallinn, Estonia. The company runs two data centres: **Frankfurt (FRA-1)** and **Oslo (OSL-2)**. A third region in Montreal is planned for Q2 2027 but is not yet available.

The leadership team:
- CEO: Priya Raghunathan
- CTO: Dana Vartanian
- Head of Support: Tomasz Zieliński

## Products

- **Nimbus Vault** — object storage with versioning and 11 nines of durability. Buckets are limited to 500 TB each on the Standard plan and unlimited on Enterprise.
- **Nimbus Compute** — virtual machines in sizes S (2 vCPU / 4 GB), M (4 vCPU / 16 GB) and L (8 vCPU / 64 GB). GPU instances are only available in Frankfurt.
- **Nimbus Edge** — a CDN with 42 points of presence. Cache purges propagate within 90 seconds.

## Plans and pricing

| Plan | Monthly price | Support SLA | Included Vault storage |
|------|---------------|-------------|------------------------|
| Starter | €29 | Best effort (community forum) | 1 TB |
| Standard | €249 | 1 business day | 20 TB |
| Enterprise | Custom | 4 hours, 24/7 | Unlimited |

Enterprise customers get a named technical account manager and a dedicated Slack Connect channel. All plans include egress of 5 TB per month; additional egress costs €0.02 per GB.

## Support

Support tickets are opened through the console or by emailing support@acmecloud.example. Priority P1 (production down) tickets on the Enterprise plan are answered within 4 hours, around the clock. Standard plan tickets are answered within one business day (Monday to Friday, 08:00–18:00 CET).

Status updates are posted at status.acmecloud.example. Scheduled maintenance windows are announced at least 7 days in advance and take place on Sundays between 02:00 and 05:00 CET.

## Security and compliance

Acme Cloud holds ISO 27001 and SOC 2 Type II certifications. Customer data at rest is encrypted with AES-256; keys can be customer-managed through the Nimbus KMS add-on (€49/month). Data never leaves the region the customer selected: a bucket created in Oslo stays in Oslo.

Backups of Nimbus Vault metadata are taken every 15 minutes and retained for 35 days.

## Billing

Invoices are issued on the 1st of each month and are due within 30 days. Payment methods: credit card, SEPA direct debit, and bank transfer (Enterprise only). Customers can download invoices as PDF from the console under Billing → Invoices.

Refunds are only given for outages that breach the SLA; the credit is 10% of the monthly fee for every full hour of downtime beyond the SLA, capped at 100% of the monthly fee.
