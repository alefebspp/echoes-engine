# Cloud roadmap — job-offer ready

A hands-on path to the cloud skills that get **backend / platform / Cloud-aware SWE** offers. Primary vendor: **AWS** (largest job market). Concepts transfer to GCP/Azure.

**Practice project:** deploy and operate **Echoes Engine** (NestJS + Postgres + Redis + workers), not toy demos.

Companions: [career-next-steps.md](./career-next-steps.md) · [learning-walkthrough.md](./learning-walkthrough.md) · [cloud-skill-builder-order.md](./cloud-skill-builder-order.md)

---

## Goal (definition of done)

You are job-offer ready for cloud-aware backend roles when you can:

1. **Design** a secure, multi-AZ architecture for an API + DB + queue/worker on a whiteboard
2. **Ship** Echoes (or equivalent) to AWS with IaC, CI/CD, secrets, health checks, and a rollback story
3. **Operate** it — logs, metrics, traces, alerts, cost visibility, incident narrative
4. **Explain** tradeoffs (EC2 vs containers vs serverless; SQS vs Redis; RDS vs DynamoDB) in interviews
5. **Optional signal:** AWS Solutions Architect – Associate (SAA) **after** one real deploy — not before

This is not “collect every AWS service.” It is **ship + operate + communicate**.

---

## How to study (non-negotiable)

| Do | Don’t |
|----|--------|
| Build on a free-tier / low-cost AWS account with billing alarms day 1 | Binge cert videos with zero console time |
| Map every service to a *concept* (compute, identity, network, data, messaging, observability) | Memorize service names without failure modes |
| Use Echoes as the recurring lab | Spin disposable “hello Lambda” apps and abandon them |
| Write a short ADR per major cloud decision | Skip docs because “the tutorial worked” |
| Prefer depth on the happy path + failure path | Tour 40 services lightly |

**Weekly rhythm (suggested):** 6–10h — 60% hands-on, 20% docs/architecture, 20% interview drills / write-up.

**Billing safety:** AWS Budgets + Cost Explorer + billing alarm at a low threshold before anything else.

---

## Technology → concept map

| AWS (learn here) | Concept | Also appears as |
|------------------|---------|-----------------|
| IAM, STS | Identity, least privilege, roles vs users | GCP IAM, Azure Entra |
| VPC, subnets, SG, NACL | Network isolation, blast radius | VPC, VNet |
| EC2 / ECS Fargate / App Runner / Lambda | Compute models | GCE, Cloud Run, Functions |
| ALB + Target Groups | L7 load balancing, health checks | Cloud Load Balancing |
| RDS PostgreSQL | Managed relational DB, backups, Multi-AZ | Cloud SQL |
| ElastiCache Redis | Managed cache / broker | Memorystore |
| SQS (+ DLQ), SNS, EventBridge | Async messaging, fan-out, schedules | Pub/Sub, Service Bus |
| S3 | Object storage, versioning, lifecycle | GCS, Blob |
| Secrets Manager / SSM Parameter Store | Secrets & config | Secret Manager |
| CloudWatch (logs, metrics, alarms) | Observability | Cloud Monitoring + Logging |
| X-Ray / OTel | Distributed tracing | Cloud Trace |
| ECR + Docker | Container images | Artifact Registry |
| Route 53 + ACM | DNS + TLS | Cloud DNS + certs |
| CloudFront (optional) | CDN / edge | Cloud CDN |
| Terraform (or CDK) | Infrastructure as Code | same tools, any cloud |
| GitHub Actions | CI/CD to cloud | Cloud Build, etc. |

Local Echoes today (`docker compose` Postgres + Redis) maps cleanly to **RDS + ElastiCache + containerized API/worker**.

---

## Roadmap overview

```
0. Foundations & account hygiene
1. Identity, network, compute (run something)
2. Data plane (RDS, Redis, S3, secrets)
3. Echoes on AWS (first production-shaped deploy)
4. Async & scale (queues, workers, HA thinking)
5. Observability, reliability, cost
6. IaC + CI/CD (repeatable environments)
7. Security hardening & compliance basics
8. Interview fluency + optional SAA
9. Stretch (only if role needs it)
```

Suggested calendar (part-time): **~4–7 months**. Full-time focus: **~10–14 weeks**. Parallel with finishing Echoes Phases 5–6 is fine if cloud labs stay weekly.

---

### Phase 0 — Foundations & account hygiene (3–5 days)

**Outcome:** safe account, mental model of regions/AZs, CLI working.

**Learn**

- Regions, Availability Zones, shared responsibility model
- Global vs regional services
- AWS CLI + SSO/IAM user (lab only), MFA on root
- Pricing mental model: compute hours, storage GB, data transfer traps

**Do**

- [ ] Create account; enable MFA on root; never use root for daily work
- [ ] Create billing alarm + monthly budget
- [ ] Install AWS CLI; `aws sts get-caller-identity` works
- [ ] Sketch: region, 2+ AZs, public vs private subnet (paper is enough)

**Exit when:** you can explain shared responsibility and why root MFA + billing alarms matter.

---

### Phase 1 — Identity, network, compute (1–2 weeks)

**Outcome:** a container or VM serves HTTP behind a load balancer in a VPC you understand.

**Learn**

- **IAM:** users vs roles vs policies; least privilege; instance/task roles (no long-lived keys on servers)
- **VPC:** public/private subnets, Internet Gateway, NAT (cost!), Security Groups (stateful) vs NACLs
- **Compute choice for backends:**
  - EC2 — full control, more ops
  - **ECS Fargate** — best default for Nest + worker (matches Docker mental model)
  - App Runner — faster path, less control
  - Lambda — great for event glue; awkward for long-lived BullMQ workers
- ALB health checks, target groups, sticky sessions (usually avoid)

**Do**

- [ ] Deploy a minimal Nest “hello + `/health`” to ECS Fargate *or* EC2 behind ALB
- [ ] Task/instance uses an **IAM role**; no access keys in env for AWS APIs
- [ ] Security Group: ALB → app only; app not world-open on DB ports
- [ ] Tear down or tag resources; note monthly estimate

**Echoes tie-in:** same Dockerfile/process model you already use locally.

**Exit when:** you can draw VPC + ALB + service and explain why the DB subnet stays private.

---

### Phase 2 — Data plane (1–2 weeks)

**Outcome:** managed Postgres + Redis + object storage + secrets, reachable only as designed.

**Learn**

- **RDS PostgreSQL:** parameter groups, backups, Multi-AZ vs read replicas, connection limits, SSL
- **ElastiCache Redis** (or MemoryDB later): network placement, AUTH/TLS
- **S3:** buckets, IAM policies, versioning, lifecycle (exports, backups, static assets)
- **Secrets Manager / SSM:** rotate JWT secrets, DB URLs; inject at runtime
- Migrations story on managed DB (your TypeORM migrations against RDS)

**Do**

- [ ] Create RDS Postgres in private subnet; connect from app task only
- [ ] Run Echoes migrations against RDS
- [ ] Provision Redis reachable from API + worker
- [ ] Move `JWT_SECRET` / DB password to Secrets Manager (or SSM SecureString)
- [ ] Put one object in S3 with least-privilege role (e.g. future export package)

**Exit when:** you can explain Multi-AZ RDS vs “I hope the single instance is fine,” and why secrets are not in `.env` on disk in prod.

---

### Phase 3 — Echoes on AWS (2–3 weeks) ★ portfolio milestone

**Outcome:** real product shape in the cloud — the resume bullet.

**Architecture target (v1)**

```
Internet → Route 53 → ALB (HTTPS/ACM)
              → ECS service: API
              → ECS service: worker (outbox + enrichment/embedding)
         → RDS Postgres (private)
         → ElastiCache Redis (private)
         → Secrets Manager
         → CloudWatch Logs
```

**Do**

- [ ] API + worker as separate services/tasks (scale independently)
- [ ] Env parity with [`.env.example`](../.env.example): DB, Redis TLS if required, outbox flags, OpenAI key in secrets
- [ ] HTTPS with ACM; HTTP redirects or disabled
- [ ] Health check endpoint used by ALB
- [ ] Document deploy steps + architecture diagram in `docs/` (or ADR)
- [ ] Prove: ingest event → outbox → worker processes in AWS
- [ ] Rollback story written: previous task definition / image tag

**Write an ADR:** “Why ECS Fargate for Echoes (vs Lambda / App Runner / EC2).”

**Exit when:** a stranger with the URL can hit health + authenticated ingest; you can redeploy without SSH snowflake edits.

---

### Phase 4 — Async & scale thinking (1–2 weeks)

**Outcome:** cloud messaging literacy; know when to keep Redis/BullMQ vs introduce SQS.

**Learn**

- SQS standard vs FIFO; visibility timeout; DLQ; idempotent consumers (you already know this from Phase 4)
- SNS fan-out; EventBridge for schedules/saas events
- When Redis/BullMQ is enough vs when SQS helps (multi-language consumers, buffering spikes, AZ-friendly durability)
- Horizontal scaling of API tasks; worker concurrency vs DB pool exhaustion
- Optional: replace only *one* path with SQS to learn — do not rewrite Echoes blindly

**Do**

- [ ] Build a small SQS → consumer lab (can be a tiny Lambda or sidecar) with DLQ
- [ ] Map Echoes outbox publisher to “at-least-once + idempotent handler” in cloud vocabulary
- [ ] Load-smoke: raise API task count; watch RDS connections and Redis

**Exit when:** you can compare BullMQ-on-Redis vs SQS in an interview without dogma.

---

### Phase 5 — Observability, reliability, cost (1–2 weeks)

**Outcome:** you debug production like a senior.

**Learn**

- CloudWatch Logs (structured JSON), Metrics, Alarms, Dashboards
- Correlation: `requestId` / `eventId` across API → worker (Echoes async boundary)
- Traces: AWS X-Ray or OpenTelemetry → backend of choice
- SLOs lite: availability + latency for ingest; error-rate alarm
- Cost: Cost Explorer, rightsizing, NAT Gateway tax, idle load balancers
- Backups/restore drill for RDS (actually restore to a scratch instance once)

**Do**

- [ ] Alarms: 5xx spike, unhealthy hosts, RDS CPU/storage, DLQ depth (if any), budget
- [ ] Dashboard: request count, p95 latency, worker failures
- [ ] One written incident postmortem from a forced failure (kill worker, revoke secret, fill disk)
- [ ] Tag all resources (`Project=echoes`, `Env=dev`)

**Exit when:** you can narrate “how I’d find a stuck enrichment job in AWS” in under 3 minutes.

---

### Phase 6 — IaC + CI/CD (2–3 weeks)

**Outcome:** environments are reproducible; deploys are boring.

**Learn**

- **Terraform** (preferred market default) *or* AWS CDK — pick one and go deep
- State backend (S3 + DynamoDB lock); workspaces or folders for `dev` / `prod`
- GitHub Actions: build → test → migrate → push ECR → update ECS service
- Immutable releases: image digest/tag; never “docker commit” in prod
- Blue/green or rolling with ALB; migration expand/contract awareness

**Do**

- [ ] Express Phase 3 architecture in Terraform/CDK (VPC, ECS, RDS, Redis, ALB, IAM, secrets refs)
- [ ] Pipeline: `main` → deploy `dev`; tagged release → `prod` (prod can be later)
- [ ] `terraform plan` in CI (policy: no apply from laptop for prod)
- [ ] Document how to destroy/recreate `dev` safely

**Exit when:** you can wipe `dev` and recreate from IaC + pipeline with only secrets bootstrap.

---

### Phase 7 — Security hardening (1–2 weeks)

**Outcome:** default-deny thinking; interview-proof security story.

**Learn**

- IAM Access Analyzer; no `*` on sensitive actions in prod roles
- Security Groups as allowlists; VPC Flow Logs (concept)
- WAF on ALB (basic managed rules) — optional but good talking point
- Private egress patterns; cautious NAT
- Encryption: RDS at rest, TLS in transit, S3 block public access
- Cognito / OAuth2/OIDC overview (pair with “auth beyond JWT” from career doc)
- Backup access control; cloud trail / audit awareness (CloudTrail on)
- RAG/OpenAI keys: scoped secret, rotation, never in client

**Do**

- [ ] CloudTrail enabled; S3 public access blocked on all lab buckets
- [ ] Review every IAM policy attached to Echoes tasks — shrink to minimum
- [ ] Threat-model one page: stolen JWT, SSRF, prompt injection via page title, leaked `OPENAI_API_KEY`
- [ ] Dependency/image scanning in CI (even basic)

**Exit when:** you can walk through Echoes threat model and matching AWS controls.

---

### Phase 8 — Interview fluency + optional certification (2–4 weeks, ongoing)

**Outcome:** offers, not just infrastructure.

**Practice prompts (answer with Echoes as the example)**

- Design browsing-event ingest at 1k RPS with enrichment workers
- DB dies in one AZ — what happens? What did you provision?
- Exactly-once vs at-least-once for tagging jobs on SQS/BullMQ
- Where do secrets live? How does the task get them?
- Cost spikes overnight — how do you investigate?
- Migrate schema with zero/low downtime on RDS

**Certification (optional, after Phase 3+)**

| Cert | When | Why |
|------|------|-----|
| **SAA (Solutions Architect Associate)** | After one real Echoes deploy | Strongest general interview signal |
| Cloud Practitioner | Skip unless employer pays | Low signal if you already build |
| Developer Associate | Optional second | App/CI focus; redundant if portfolio is strong |
| AI Practitioner | Only if targeting GenAI platform roles | Complements Phase 6 Echoes IA |

Study with **Skill Builder labs + practice exams**, not video-only. Cert validates vocabulary; **portfolio validates hireability**.

**Portfolio artifacts to publish**

- [ ] Architecture diagram (Phase 3)
- [ ] ADR set (compute choice, networking, secrets, messaging)
- [ ] Public write-up: “Deploying an outbox/worker Nest app on ECS”
- [ ] Cost note: typical monthly `dev` spend

**Exit when:** two mock system-design interviews feel concrete, and your GitHub/docs show the AWS deploy.

---

### Phase 9 — Stretch (role-dependent; do not block offers)

Pick **only** what the jobs you want list repeatedly:

| Topic | Learn when |
|-------|------------|
| **EKS / Kubernetes** | Job specs say K8s; otherwise ECS is enough |
| **Multi-account Organizations + Landing Zone** | Platform / DevOps track |
| **Kafka / MSK** | High-throughput event platforms |
| **Data lake:** S3 + Glue + Athena | Analytics-heavy roles |
| **Advanced networking:** PrivateLink, Transit Gateway | Enterprise / platform |
| **GCP Cloud Run + Cloud SQL** | 2–3 week transfer lab after AWS fluency |
| **Serverless-heavy** API Gateway + Lambda | Product is glue/event-shaped |

---

## Echoes-specific lab checklist (north star)

Use this as the capstone filter — if these are green, you are in offer territory for cloud-aware backend roles:

- [ ] HTTPS API on ALB + ACM
- [ ] RDS Postgres with migrations in CI/CD
- [ ] Redis for BullMQ reachable privately
- [ ] API and worker independently deployable
- [ ] Secrets not in git; injected at runtime
- [ ] CloudWatch logs + at least two meaningful alarms
- [ ] IaC can recreate `dev`
- [ ] Documented rollback + one restore drill
- [ ] Architecture ADR + diagram in repo
- [ ] You can explain the design in 10 minutes

---

## Suggested 16-week plan (part-time)

| Weeks | Phase | Milestone |
|-------|-------|-----------|
| 1 | 0–1 | VPC + ALB + sample service |
| 2–3 | 2 | RDS + Redis + secrets |
| 4–6 | 3 | Echoes API + worker live |
| 7–8 | 4–5 | Messaging literacy + alarms + postmortem |
| 9–11 | 6 | Terraform + GitHub Actions |
| 12–13 | 7 | Hardening + threat model |
| 14–16 | 8 | Interview drills + optional SAA |

Adjust: if Echoes Phase 6 IA is still in progress, keep cloud Phases 0–2 moving weekly so momentum does not die.

---

## Job-offer positioning (how to talk about this)

**Weak:** “I completed an AWS course.”

**Strong:** “I designed and deployed a NestJS event-ingest platform on ECS Fargate with RDS, Redis workers (outbox pattern), Secrets Manager, ALB/HTTPS, CloudWatch alarms, and Terraform + GitHub Actions. I can walk through failure modes and cost tradeoffs.”

That sentence is the point of this roadmap.

---

## Related docs

- [cloud-skill-builder-order.md](./cloud-skill-builder-order.md) — Skill Builder study order mapped to this roadmap
- [career-next-steps.md](./career-next-steps.md) — broader market gaps beyond cloud
- [learning-walkthrough.md](./learning-walkthrough.md) — Echoes engineering phases
- [concepts-still-to-learn.md](./concepts-still-to-learn.md) — remaining product/architecture concepts
- [adr/0004-async-tagging-outbox.md](./adr/0004-async-tagging-outbox.md) — async pattern you will re-explain in cloud terms

---

*Created September 2026 · AWS-first, Echoes-as-lab, offers over cert tourism*
