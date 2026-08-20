
# Coordinating a 60-Agent AI Workforce
## System Design Report — Qimmah Command Center

**Date:** August 20, 2026
**Prepared for:** Qimmah Command Center
**Scope:** A system for communicating with and coordinating 60 AI agents so they operate as one efficient, self-balancing workforce.

---

## 1. Executive Summary

Running 60 AI agents productively is not a scaling problem in the traditional sense — it's a coordination problem. The moment a fleet crosses a handful of agents, three things break down if left to manual oversight: nobody can reliably match a task to the agent best suited for it, nobody can see who's overloaded until something is late, and agents can't hand work to each other without a human relay.

This report proposes a five-part system: a **capability taxonomy** that groups agents by specialty, a **standardized interface** every agent exposes regardless of its underlying model or tool stack, a **work assignment system** that routes tasks to the best-fit, least-loaded agent automatically, a **communication protocol** that lets agents talk to each other and to the router without ambiguity, and a **monitoring system** that watches load, quality, and health in real time and feeds that data back into routing decisions.

The design is deliberately layered so it can be adopted incrementally — a categorization scheme and standard interface deliver value even before the routing engine exists, and the monitoring system can start as dashboards before it becomes an automated feedback loop.

---

## 2. Problem Framing

At 60 agents, the operating model has to answer four questions cleanly, or coordination overhead grows faster than the value the agents produce:

1. **Who can do this task?** — Not every agent should see every task. Some are tuned for code, some for research, some for customer-facing writing. Matching by capability, not by availability, is what improves accuracy.
2. **Who *should* do this task right now?** — Capability alone isn't enough; the best-fit agent might already be at capacity. This is where workload-aware assignment matters.
3. **How do two agents coordinate on a shared task?** — A research agent that hands findings to a writing agent, or a coding agent that needs a review agent to check its work, needs a shared message format and a way to track state across that handoff.
4. **How do we know it's working?** — Without monitoring, overload and quality drift are invisible until a deadline is missed or a customer notices a bad output.

The rest of this report addresses each in turn.

---

## 3. Agent Categorization

### 3.1 Approach

Rather than one flat list of 60 agents, group them along two independent axes: **specialty domain** (what kind of work they're good at) and **capability tier** (how autonomous and how expensive/slow they are to run). A single agent registry entry then carries both a domain tag and a tier, which is what the router uses to narrow candidates before picking one.

### 3.2 Domain categories (proposed starting set)

| Category | Description | Example responsibilities |
|---|---|---|
| Research & Analysis | Information gathering, synthesis, fact-checking, competitive/market research | Literature review, data gathering, source verification |
| Code & Engineering | Writing, reviewing, refactoring, and testing code | Feature implementation, bug fixes, code review, test authoring |
| Content & Communication | Long-form writing, editing, copywriting, translation | Reports, marketing copy, documentation, correspondence |
| Data & Analytics | Structured data work — cleaning, modeling, visualization, statistics | Spreadsheet builds, dashboards, forecasting |
| Operations & Process | Workflow design, scheduling, task triage, admin automation | Ticket routing, calendar management, SOPs |
| Customer-Facing | Support, sales enablement, tone-sensitive external communication | Ticket responses, chat handling, outreach drafts |
| Design & Visual | Diagrams, presentations, layout, visual assets | Slide decks, diagrams, image generation coordination |
| Orchestration & QA | Meta-agents that supervise, review, or route other agents' work | Quality review, task decomposition, escalation handling |

Every agent in the fleet gets at least one primary category and may declare up to two secondary categories, so a "Code & Engineering" agent that's also strong at "Data & Analytics" can be discovered for either kind of task without being duplicated in the registry.

### 3.3 Capability tiers

Independent of domain, each agent is tagged with a tier that describes its operating envelope:

- **Tier 1 — Fast/Light:** Quick, narrow tasks; low latency and cost; used for high-volume, low-ambiguity work (e.g., formatting, simple lookups, short replies).
- **Tier 2 — Standard:** General-purpose task execution requiring moderate reasoning and multi-step tool use; the default tier for most assigned work.
- **Tier 3 — Deep/Specialist:** Complex, high-stakes, or long-running tasks requiring extended reasoning, larger context, or domain expertise; used sparingly because of cost and latency.

Tagging by tier lets the assignment system avoid two common failure modes: routing a trivial task to an expensive specialist agent (wasteful) and routing a complex task to a fast/light agent (produces poor output that then needs rework).

### 3.4 Registry record

Each agent's entry in the categorization registry should carry, at minimum: agent ID, display name, primary category, secondary categories (0–2), tier, supported task types (a controlled vocabulary, not free text), tool/connector access, current status (active, degraded, offline), and a rolling performance score (defined in Section 7). This registry is the single source of truth the assignment system queries — no assignment decision should be made against stale or duplicated agent metadata.

---

## 4. Standardized Interface

### 4.1 Why standardization matters at this scale

With 60 agents potentially built on different underlying models, tool sets, and even different vendors, the coordination layer cannot afford to special-case each one. The fix is a thin, uniform contract every agent must implement — regardless of what's happening inside it — so the router, the message bus, and the monitoring system only ever need to speak one dialect.

### 4.2 The contract

Every agent exposes four operations:

**`describe()`** — Returns the agent's static self-description: category, tier, supported task types, input/output schemas it accepts, and current tool/connector access. This is what populates and refreshes the registry (Section 3.4) and lets new agents onboard without a human manually writing their metadata.

**`accept(task)`** — Given a task object (defined in Section 5.2), the agent returns one of: accept, decline (with a reason code — out of scope, over capacity, missing tool access), or accept-with-conditions (e.g., "I can do this but need agent X's output first"). This is the hook that makes workload-aware routing possible: an overloaded agent can decline before wasting cycles on a task it will do poorly or late.

**`execute(task) → result | status_update`** — Runs the task and streams status updates (see Section 6.3) plus a final result conforming to the standard result schema: output payload, confidence/self-assessment, tools used, time taken, and any sub-tasks it delegated to other agents.

**`health()`** — Returns a lightweight liveness and load signal: current queue depth, average recent latency, error rate, and a simple healthy/degraded/offline flag. Polled by the monitoring system (Section 7) and checked by the router before assignment.

### 4.3 Adapter layer

Not every agent will natively speak this contract — some may be third-party tools, legacy scripts, or agents built on frameworks that don't expose these four hooks directly. Each such agent gets a thin adapter that translates the standard contract into whatever that agent's native interface requires. This keeps the standardization cost at the edge (one adapter per non-native agent) rather than forcing a rewrite of the whole fleet, and it means the categorization, assignment, communication, and monitoring systems never need to know an agent is non-native.

---

## 5. Work Assignment System

### 5.1 Goal

Automate the match between an incoming task and the most suitable *available* agent, removing manual triage while improving accuracy over ad hoc assignment.

### 5.2 Task object

Every unit of work entering the system is normalized into a task object before assignment: task ID, required category (and optional secondary categories), required tier (or "any"), priority, deadline/SLA, input payload, dependencies (task IDs that must complete first), and an originating requester (human or another agent).

### 5.3 Assignment pipeline

1. **Normalize** — Incoming requests (from humans or from other agents) are converted into the standard task object.
2. **Filter** — The registry is queried for agents matching the required category and tier, and whose `health()` reports healthy or degraded-but-accepting.
3. **Rank** — Candidates are scored on a weighted combination of: capability fit (primary category match scores higher than secondary), current load (lower queue depth scores higher), historical performance score for this task type (Section 7.2), and priority alignment (a Tier 3 specialist isn't pulled for a low-priority task if a Tier 2 generalist can do it).
4. **Offer** — The task is offered to the top-ranked agent via `accept()`. On decline, it falls to the next-ranked candidate.
5. **Assign & track** — Once accepted, the task is logged with assigned agent, timestamp, and expected completion window, and moves into the monitoring system's active-task view.
6. **Rebalance** — If an agent's queue grows past a configured threshold mid-cycle, queued-but-not-yet-started tasks for that agent are eligible for reassignment to the next best-fit agent (see Section 7.3 for the overload trigger).

### 5.4 Handling ambiguous or multi-domain tasks

Tasks that span categories (e.g., "research this topic and turn it into a slide deck") are decomposed rather than force-fit to one agent. An Orchestration & QA agent (Section 3.2) — or the assignment system itself acting in that role for simple splits — breaks the task into sub-tasks, each separately routed, with the parent task remaining open until all sub-tasks and the final assembly step complete. This decomposition step is what keeps the categorization scheme from becoming a bottleneck as real-world requests rarely fall neatly into one bucket.

### 5.5 Priority and fairness

Priority alone can starve lower-priority work indefinitely in a busy fleet. The ranking function should include a small aging factor — a task's effective priority ticks up the longer it waits unassigned — so nothing sits in the queue forever just because higher-priority work keeps arriving.

---

## 6. Communication Protocol

### 6.1 Design principles

Three things make agent-to-agent communication reliable at this scale: every message has a fixed, predictable shape; every exchange is traceable back to the task it belongs to; and agents never need a direct point-to-point connection to each other — they publish and subscribe through a shared bus.

### 6.2 Topology: message bus, not mesh

A direct mesh where each of 60 agents can call any other directly creates 60×59 potential connections and makes monitoring, retries, and auditing very difficult. Instead, all inter-agent traffic flows through a central **message bus** organized by topic (roughly aligned to the categories in Section 3.2, plus a system-wide control topic). Agents publish messages and results to topics; the router and interested agents subscribe. This also means the monitoring system can observe all traffic from one place rather than instrumenting 60 separate channels.

### 6.3 Message types

- **Task offer / accept / decline** — the assignment handshake described in Section 5.3.
- **Status update** — periodic progress pings from an agent executing a long-running task (percent complete, current step, estimated remaining time).
- **Result** — the final output of a task, conforming to the standard result schema (Section 4.2), published back to the requester's topic.
- **Handoff request** — one agent requesting that a specific downstream step be picked up by another (e.g., research agent → writing agent), carrying the task ID, the accumulated context, and what's needed next.
- **Escalation** — raised when an agent cannot complete a task (missing access, ambiguous requirements, conflicting sub-results) and needs human or Orchestration & QA agent intervention.
- **Heartbeat** — the `health()` payload (Section 4.2), published on a fixed interval and consumed by the monitoring system.

### 6.4 Message envelope

Every message, regardless of type, carries a common envelope: message ID, task ID, correlation ID (links related messages across a multi-step handoff), sender agent ID, timestamp, message type, and a typed payload. This is what makes the whole system auditable after the fact — any task's full history can be reconstructed by pulling every message with its task ID.

### 6.5 Failure handling

Messages that go unacknowledged within a type-specific timeout are retried a bounded number of times before the task is automatically escalated (Section 6.3) and, in parallel, reassigned per Section 5.3 step 6. This prevents a single unresponsive agent from silently stalling a task indefinitely.

---

## 7. Monitoring System

### 7.1 What to track

- **Workload** — queue depth and active task count per agent, sourced from `health()` heartbeats.
- **Throughput** — tasks completed per agent per unit time, by category and tier.
- **Latency** — time from assignment to completion, compared against the task's SLA.
- **Quality** — a performance score built from explicit signals (requester or QA-agent ratings, rework/escalation rate) and implicit signals (self-reported confidence from the result schema, whether output passed downstream validation).
- **Health** — error rate, timeout rate, and the healthy/degraded/offline flag over time.

### 7.2 Performance score

Each agent's registry entry (Section 3.4) carries a rolling performance score per task category — not one global number, since an agent can be excellent at research and mediocre at code review. This score feeds directly back into the ranking step of the assignment pipeline (Section 5.3), which is what closes the loop between monitoring and assignment: agents that consistently perform well on a task type get preferred for more of it, and agents whose quality drifts down get deprioritized automatically rather than by manual intervention.

### 7.3 Overload detection and rebalancing

A configurable threshold (e.g., queue depth or projected completion time exceeding SLA) marks an agent as overloaded. When that happens: new tasks stop being routed to that agent until it clears below the threshold, queued (not-yet-started) tasks already assigned to it become eligible for reassignment, and a dashboard/alert signals the condition so a human can intervene if the overload is fleet-wide rather than agent-specific (e.g., total incoming volume genuinely exceeds the fleet's capacity, which routing alone can't fix).

### 7.4 Dashboard and feedback

A single operational view should show, at a glance: current load per agent and per category, tasks approaching SLA breach, recent escalations, and category/tier combinations that are systematically over- or under-provisioned (a signal for when to add, retrain, or retire an agent). This is the human-facing layer — everything upstream is designed to reduce how often a human needs to look at it, but when they do, the view should be immediately actionable.

---

## 8. How the Pieces Fit Together

Categorization (Section 3) makes agents discoverable. The standardized interface (Section 4) makes every agent speak the same language regardless of what's underneath. The assignment system (Section 5) uses the registry and interface to route work automatically and accurately. The communication protocol (Section 6) is the substrate all of that runs on, and the medium through which agents collaborate on multi-step work. The monitoring system (Section 7) watches everything and feeds performance and load data straight back into assignment, closing the loop.

None of the five pieces is optional at 60-agent scale — remove monitoring and overload becomes invisible; remove the standard interface and every new agent is a custom integration; remove categorization and routing degenerates into guesswork.

See `diagram.md` for a visual flowchart of the full request-to-completion path, and `recommendations.md` for a phased implementation plan.

