# Nimbus Queue — On-call Runbook (SRE-RB-011)

## Service overview

Nimbus Queue is Acme Cloud's managed message queue. Each region runs a five-node broker cluster (`queue-br-1` to `queue-br-5`) behind the ingress service `queue-edge`. Messages are replicated to 3 brokers, so the cluster tolerates the loss of 2 brokers without losing acknowledged messages.

Dashboards: Grafana folder "Queue" → "Queue Health". Alerts go to the `#sre-queue` Slack channel and to PagerDuty service "Nimbus Queue".

## Alert: QueueConsumerLagHigh

**Meaning:** consumer lag above 50,000 messages on any partition for 10 minutes.

**Steps:**

1. Check whether the consumer group is still connected in "Queue Health" → "Consumers".
2. If a single partition is hot, rebalance it: `queuectl partition rebalance <topic> --max-moves 4`.
3. If every partition is lagging, ask the owning team to scale their consumers; do not scale brokers for consumer lag.

## Alert: QueueBrokerDiskFull

**Meaning:** a broker's data disk is above 90% usage.

**Steps:**

1. Lower retention on the largest topic: `queuectl topic retention <topic> --hours 24`.
2. If usage is still above 90% after 30 minutes, add a disk with the storage team (queue DC-DISK).
3. Never delete segment files by hand.

## Alert: QueueEdgeErrorRate

**Meaning:** more than 2% of `queue-edge` requests return 5xx for 5 minutes. This is a **P2 alert**.

**Steps:**

1. Roll back the last `queue-edge` deployment if it is younger than 1 hour: `kubectl -n queue rollout undo deploy/queue-edge`.
2. Otherwise restart the unhealthy pods one at a time.

## Escalation

- Primary on-call: rotates every two weeks, schedule in PagerDuty.
- Secondary on-call: the Queue team lead (currently Ines Okafor).
- Escalate to the Director of Platform (Rahel Tesfaye) after 3 hours of an unresolved P1.

## Post-incident

P1 incidents get a post-mortem within 3 working days; P2 incidents within 10 working days. Action items are tracked in Jira project QUEUE.
