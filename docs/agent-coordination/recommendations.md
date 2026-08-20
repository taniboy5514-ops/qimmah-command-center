[recommendations.md](https://github.com/user-attachments/files/31255979/recommendations.md)
# Recommendations — Implementing the 60-Agent Coordination System

Companion to `report.md` and `diagram.md`. These recommendations are ordered as a phased rollout rather than a flat list, since attempting all five subsystems (categorization, interface, assignment, communication, monitoring) at once is the most common way this kind of project stalls.

## Phase 1 — Foundation (Weeks 1–3)

Build the agent registry first, before anything else touches it. Every one of the 60 agents needs an entry with category, tier, and supported task types (Section 3.4 of the report) — this alone, even with manual routing, immediately improves assignment accuracy because task requesters can see who's actually suited for the work. In parallel, define the standard interface contract (`describe`, `accept`, `execute`, `health`) and get it running on a small pilot group of 5–8 agents spanning at least three categories, so the contract gets tested against real variety before being rolled out fleet-wide. Expect the adapter layer (Section 4.3) to take longer than the native agents — budget time for it rather than treating it as an afterthought.

## Phase 2 — Assignment automation (Weeks 3–6)

Stand up the assignment pipeline against the pilot group only. Start with a simple ranking function (capability fit and current load; skip the performance-score weighting until Phase 3 produces real data to weight with) and validate it against tasks that already have a known "correct" agent, so misrouting is caught before it reaches production volume. Roll out to the full 60-agent fleet only after the pilot group's routing accuracy is being tracked and looks acceptable — rolling out to all 60 before validating the ranking logic on a subset risks compounding a bad routing rule across the whole fleet at once.

## Phase 3 — Communication protocol (Weeks 5–8, overlapping Phase 2)

Implement the message bus and the six message types (Section 6.3) starting with task offer/accept/decline and result — the minimum needed for the assignment pipeline to function — before adding handoff and escalation support. Multi-agent handoffs are where most coordination bugs surface, so test them deliberately with a scripted two-agent handoff (e.g., research agent → writing agent) before relying on it for real multi-step work. Instrument the bus for full message logging from day one; retrofitting audit trails after problems appear is far more expensive than building them in from the start.

## Phase 4 — Monitoring and feedback loop (Weeks 7–10)

Launch the dashboard (Section 7.4) before the automated rebalancing logic — a human watching load and quality manually for a couple of weeks will surface threshold values (what counts as "overloaded," what counts as a quality drop) that are far more reliable than guessed defaults. Only after those thresholds are grounded in real observed data should overload-triggered reassignment (Section 7.3) and performance-score-weighted ranking (Section 7.2) go live. Treat the performance score as a slow-moving signal — update it on a rolling window (e.g., trailing 20 tasks per category) rather than after every single task, so one bad or one lucky outcome doesn't swing an agent's ranking.

## Phase 5 — Fleet-wide rollout and tuning (Weeks 9–12)

Extend everything from the pilot group to the full 60 agents in category-sized batches rather than all at once, so a bad interaction between two subsystems affects one category's worth of agents rather than the whole fleet while it's being diagnosed. Use the first month of full-fleet data to identify systematically over- or under-provisioned category/tier combinations (Section 7.4) — this is the point at which decisions about adding, retraining, or retiring specific agents should be made, not earlier when the data is too thin to be reliable.

## Cross-cutting recommendations

Keep a human escalation path live at every phase — the goal of this system is to reduce manual intervention for routine assignment and monitoring, not to remove human oversight for genuinely ambiguous or high-stakes tasks. Version the standard interface contract from the start (e.g., an interface version field in `describe()`) so the contract can evolve without breaking every agent simultaneously. Avoid letting the category list grow unboundedly — new categories should require a deliberate decision, since a sprawling taxonomy defeats the purpose of routing by making "best fit" ambiguous again. Finally, revisit the ranking function's weights (capability fit vs. load vs. performance vs. priority) roughly every month once real data exists — the right balance for a fleet skewed toward Tier 3 specialists will differ from one skewed toward Tier 1 fast agents, and that skew will likely shift as the fleet grows.
