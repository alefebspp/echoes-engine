# AWS Skill Builder study order

How to walk [AWS Skill Builder](https://skillbuilder.aws/) in lockstep with [cloud-roadmap.md](./cloud-roadmap.md).

**Rule:** Skill Builder teaches the *service*; Echoes proves you can *operate* it. Do **not** grind the full SAA Exam Prep Plan before Phase 3 is shipped.

Search Skill Builder by the names in quotes — titles can vary slightly by language/region.

Companions: [cloud-roadmap.md](./cloud-roadmap.md) · [career-next-steps.md](./career-next-steps.md)

---

## How to use each step

For every step below:

1. Open the Learning Plan / course in Skill Builder
2. Finish its lessons + quizzes
3. Do any **Cloud Quest** / **Builder Lab** for that topic
4. Complete the **Echoes checkpoint** before moving on

**Free vs paid:** Steps 0–3 work on the free Skill Builder tier + your own AWS account. A subscription (~$29/mo) or [student Skill Builder access](https://builder.aws.com/learn/students) helps most in Steps 1–2 (labs) and Step 8 (official practice exam).

---

## Study order

### Step 0 — Account hygiene (Roadmap Phase 0)

**Skill Builder**

- Course: **"AWS Cloud Practitioner Essentials"** *or* **Cloud Quest: Cloud Practitioner** (pick one; Cloud Quest if you want labs early)
- Optional free plan: **"Introduction to AWS Cloud – AWS Builder Labs"** (10 free labs)

**Echoes checkpoint:** MFA on root, billing alarm, CLI works (`aws sts get-caller-identity`), sketch region + 2 AZs.

**Exit when:** you can explain shared responsibility and why root MFA + billing alarms matter.

---

### Step 1 — Identity, network, compute (Phase 1)

**Skill Builder**

1. Enroll in **"AWS Solutions Architect Learning Plan"** — work only the early modules on:
   - IAM / security foundations
   - VPC / networking
   - Compute (EC2)
   - Load balancing
   - Containers / ECS (when the plan reaches them)
2. Cloud Quest assignments that touch **VPC, EC2, IAM, ELB**
3. Builder Labs (free ones if available; more with subscription): VPC, Security Groups, ALB, ECS/Fargate

**Echoes checkpoint:** Nest `/health` on **ECS Fargate + ALB**, task role (no long-lived keys), Security Group: ALB → app only.

**Exit when:** you can draw VPC + ALB + service and explain why the DB subnet stays private.

---

### Step 2 — Data plane (Phase 2)

**Skill Builder** (still inside the Solutions Architect plan, plus targeted courses)

Search and complete digital courses / labs for:

- **"Amazon RDS"** (Postgres, Multi-AZ, backups)
- **"Amazon ElastiCache"** (or caching courses)
- **"Amazon S3"**
- **"AWS Secrets Manager"** / **"Systems Manager Parameter Store"**

**Echoes checkpoint:** Private RDS + Redis, TypeORM migrations against RDS, secrets injected at runtime, one least-privilege S3 put.

**Exit when:** you can explain Multi-AZ RDS vs a single instance, and why secrets are not in `.env` on disk in prod.

---

### Step 3 — Production-shaped app (Phase 3) ★

Skill Builder becomes secondary; **your AWS account** is the main lesson.

Still useful in Skill Builder:

- Remaining **containers / ECS / ECR** modules in the SA Learning Plan
- **"AWS Certificate Manager"** + **"Amazon Route 53"** short courses
- Light **"Amazon CloudWatch"** intro (deeper in Step 5)

**Echoes checkpoint:** Full Phase 3 architecture live (API + worker + RDS + Redis + Secrets + HTTPS + logs). Write the ADR: why ECS Fargate for Echoes.

**Do not start heavy exam prep yet.**

**Exit when:** a stranger with the URL can hit health + authenticated ingest; you can redeploy without SSH snowflake edits.

---

### Step 4 — Async & scale (Phase 4)

**Skill Builder**

- Courses: **"Amazon SQS"**, **"Amazon SNS"**, **"Amazon EventBridge"**
- Any SA Learning Plan modules on decoupling / messaging
- Cloud Quest / Builder Lab with SQS + DLQ if available

**Echoes checkpoint:** Small SQS → consumer + DLQ lab; write BullMQ-on-Redis vs SQS comparison.

**Exit when:** you can compare BullMQ vs SQS in an interview without dogma.

---

### Step 5 — Observability, reliability, cost (Phase 5)

**Skill Builder**

- **"Amazon CloudWatch"** (logs, metrics, alarms)
- **"AWS X-Ray"** (or observability modules in the SA plan)
- Cost modules: **"AWS Cost Management"** / Cost Explorer content in the SA plan
- Well-Architected modules if listed (**Reliability**, **Operational Excellence**, **Cost Optimization**)

**Echoes checkpoint:** Dashboard + at least two alarms + one forced-failure postmortem + resource tags (`Project=echoes`, `Env=dev`).

**Exit when:** you can narrate “how I’d find a stuck enrichment job in AWS” in under 3 minutes.

---

### Step 6 — IaC + CI/CD (Phase 6) — Amazon-native path

The roadmap prefers Terraform + GitHub Actions. On Skill Builder only, use Amazon substitutes:

| Roadmap | Skill Builder substitute |
|---------|--------------------------|
| Terraform | **"AWS CloudFormation"** then **"AWS CDK"** (TypeScript fits Nest) |
| GitHub Actions | **"AWS CodePipeline"** + **"AWS CodeBuild"** (+ CodeDeploy if listed) |

**Order inside Skill Builder**

1. CloudFormation fundamentals
2. CDK getting started (prefer this for Echoes)
3. CodePipeline / CodeBuild deploy-to-ECS style courses / labs

**Echoes checkpoint:** Recreate `dev` with CDK or CloudFormation; pipeline builds image → ECR → ECS.

Optional later (outside Skill Builder): [HashiCorp Learn – Terraform](https://developer.hashicorp.com/terraform/tutorials) if job specs emphasize Terraform.

**Exit when:** you can wipe `dev` and recreate from IaC + pipeline with only secrets bootstrap.

---

### Step 7 — Security hardening (Phase 7)

**Skill Builder**

- SA Learning Plan **security** modules you skipped
- **"AWS CloudTrail"**, IAM Access Analyzer / least-privilege courses
- Cloud Quest **Security** role (often needs subscription)
- Encryption / S3 Block Public Access / VPC security labs

**Echoes checkpoint:** Shrink task IAM policies; CloudTrail on; one-page threat model (stolen JWT, SSRF, leaked `OPENAI_API_KEY`).

**Exit when:** you can walk through Echoes threat model and matching AWS controls.

---

### Step 8 — Interview fluency + certification (Phase 8)

**Only after Phase 3 is done** (ideally after Steps 5–7).

**Skill Builder**

1. Finish any remaining **Solutions Architect Learning Plan** gaps
2. Enroll in **"Exam Prep Plan: AWS Certified Solutions Architect – Associate"**
   - Official practice question sets (free)
   - Domain review / exam readiness courses
   - Official practice exam (subscription)
3. Optional: Cloud Quest **Solutions Architect** role for extra reps

**Then:** Schedule the real **SAA** exam via [AWS Certification](https://aws.amazon.com/certification/) (separate exam fee; training does not grant the cert).

**Echoes checkpoint:** Mock design answers using Echoes; publish architecture diagram + ADRs.

**Cloud Practitioner cert:** optional warm-up; skip if you already build — low signal vs portfolio + SAA.

**Exit when:** two mock system-design interviews feel concrete, and your GitHub/docs show the AWS deploy.

---

### Step 9 — Stretch (Phase 9)

Only if target job specs demand it. Search Skill Builder for EKS, serverless, analytics, etc. Do not block offers on this.

---

## Sequence at a glance

```
Cloud Quest CP / Cloud Practitioner Essentials
        ↓
Solutions Architect Learning Plan  ──┐
  (IAM → VPC → Compute → ELB →      │  pause for Echoes
   Containers → Data → Messaging →  │  Phases 1–5 labs
   Observability → Security)        │
        ↓                           ←┘
CDK / CloudFormation + CodePipeline (Phase 6)
        ↓
Security deep dive (Phase 7)
        ↓
Exam Prep Plan: SAA-Associate (Phase 8)
        ↓
SAA exam
```

---

## Tips

- **Skip ahead by topic** inside the SA Learning Plan to match the phase you are on. Do not feel forced to finish Lambda-heavy modules before ECS if Echoes needs Fargate first.
- **Never let a learning plan outrun** the Echoes checklist for that phase.
- **Badges ≠ certifications.** Cloud Quest / microcredentials on Credly are progress markers; **AWS Certified Solutions Architect – Associate** is the interview signal after a real deploy.
- Official hub: [skillbuilder.aws](https://skillbuilder.aws/) · Exam prep overview: [AWS Certification prep](https://aws.amazon.com/certification/certification-prep/)

---

*Aligned to cloud-roadmap.md · September 2026*
