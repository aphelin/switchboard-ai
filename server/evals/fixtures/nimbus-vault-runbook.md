# Nimbus Vault — On-call Runbook (SRE-RB-007)

## Service overview

Nimbus Vault is Acme Cloud's object storage service. Each region runs three storage clusters (`vault-a`, `vault-b`, `vault-c`) behind the gateway service `vault-gw`. Objects are erasure-coded 8+4 across clusters, so the loss of any 4 storage nodes does not cause data loss.

Dashboards: Grafana folder "Vault" → "Vault Overview". Alerts are routed to the `#sre-vault` Slack channel and to PagerDuty service "Nimbus Vault".

## Alert: VaultGatewayHighLatency

**Meaning:** p99 latency of `vault-gw` above 800 ms for 5 minutes.

**Common causes:**
1. A storage cluster is rebuilding after a node replacement (check `vault_rebuild_active`).
2. A single tenant is running a large listing operation (`vault_gw_list_ops` spikes).
3. Gateway pods are CPU-throttled.

**Steps:**
1. Open "Vault Overview" and check which cluster shows elevated `vault_read_latency_p99`.
2. If a rebuild is active, do nothing unless latency exceeds 2 seconds; rebuilds normally finish within 3 hours.
3. If one tenant dominates list operations, apply the `list-rate-limit` policy: `vaultctl tenant limit <tenant-id> --list-ops 50/s`.
4. If gateway CPU is above 85%, scale the deployment: `kubectl -n vault scale deploy vault-gw --replicas=+2` (maximum 12 replicas per region).

## Alert: VaultDurabilityRisk

**Meaning:** more than 2 storage nodes are unavailable in the same cluster. This is a **P1 alert**: page the secondary on-call immediately.

**Steps:**
1. Freeze deployments with `vaultctl freeze --reason "durability risk"`.
2. Identify the failed nodes in "Vault Nodes" and open a hardware ticket with the data-centre team (queue DC-HW).
3. Do **not** trigger a manual rebuild while more than 2 nodes are down; wait until at most 2 nodes are unavailable, then run `vaultctl rebuild start <cluster>`.
4. Post an update in `#incident-bridge` every 30 minutes until resolved.

## Alert: VaultBackupMissed

**Meaning:** no metadata backup completed in the last 45 minutes (backups are expected every 15 minutes).

**Steps:**
1. Check the backup job logs: `kubectl -n vault logs job/vault-meta-backup --tail=200`.
2. If the backup bucket is full, rotate old snapshots: `vaultctl backup prune --keep-days 35`.
3. Re-run the job manually: `kubectl -n vault create job --from=cronjob/vault-meta-backup manual-$(date +%s)`.

## Escalation

- Primary on-call: rotates weekly, schedule in PagerDuty.
- Secondary on-call: the Vault team lead (currently Mikkel Sørensen).
- Engineering manager escalation after 2 hours of unresolved P1: Dana Vartanian (CTO).

## Post-incident

Every P1 and P2 incident gets a blameless post-mortem within 5 working days, using the template in Confluence → SRE → Post-mortems. Action items are tracked in Jira project VAULT with the label `postmortem`.
