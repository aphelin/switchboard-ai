# Acme Cloud — Security Incident Response Policy (SEC-POL-003)

## Purpose

This policy defines how Acme Cloud detects, reports and handles security incidents that affect customer data, internal systems or employees.

## Reporting

Anyone who suspects a security incident reports it immediately in the `#security-report` Slack channel or by email to security@acmecloud.example. Reports can be anonymous through the whistleblower form. Nobody is blamed for reporting in good faith.

## Severity levels

| Level | Example                             | Response time  |
| ----- | ----------------------------------- | -------------- |
| SEV-1 | Confirmed customer data exposure    | 15 minutes     |
| SEV-2 | Compromised employee account        | 1 hour         |
| SEV-3 | Phishing attempt without compromise | 1 business day |

## Roles

- **Incident commander:** the on-call security engineer, who leads the response and owns communication.
- **Scribe:** keeps a timestamped log of decisions in the incident document.
- **Legal liaison:** decides whether regulators and customers must be notified.

## Customer and regulator notification

When personal data is affected, the Data Protection Officer (Marta Kowalczyk) notifies the supervisory authority within **72 hours** of becoming aware of the breach. Affected Enterprise customers are informed within **24 hours** through their technical account manager.

## Evidence handling

Logs related to an incident are copied to the write-once evidence bucket and kept for **7 years**. Affected laptops are not wiped until the incident commander releases them.

## Exercises

A tabletop exercise is run every **6 months**, and a full red-team exercise once per year by an external firm.
