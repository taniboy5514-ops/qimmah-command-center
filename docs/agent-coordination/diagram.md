[diagram.md](https://github.com/user-attachments/files/31256216/diagram.md)
# System Diagram — Qimmah Command Center: 60-Agent Coordination System

This diagram accompanies `report.md`. It shows the end-to-end path a task takes from request to completion, and how the communication protocol connects agents to the message bus.

## 8.1 Work assignment flow

```mermaid
flowchart TD
    A[Incoming request<br/>human or agent] --> B[Normalize into<br/>standard task object]
    B --> C{Registry lookup:<br/>filter by category + tier}
    C --> D[Rank candidates:<br/>fit, load, performance score, priority]
    D --> E[Offer task to<br/>top-ranked agent]
    E -->|accept| F[Agent executes task]
    E -->|decline| D
    F --> G[Status updates<br/>via message bus]
    G --> H{Task complete?}
    H -->|no, needs handoff| I[Handoff request to<br/>next-category agent]
    I --> C
    H -->|yes| J[Result published<br/>to requester's topic]
    F -->|error or stuck| K[Escalation raised]
    K --> L[Orchestration/QA agent<br/>or human review]
    F -.heartbeat.-> M[Monitoring system]
    M -->|overload detected| N[Rebalance: reassign<br/>queued tasks]
    N --> C
    M -->|performance score update| D
```

## 8.2 Communication topology

```mermaid
flowchart LR
    subgraph Bus[Central Message Bus - topic based]
        T1[Research topic]
        T2[Engineering topic]
        T3[Content topic]
        T4[Data/Analytics topic]
        T5[Operations topic]
        T6[Customer-Facing topic]
        T7[Design topic]
        T8[Control / Orchestration topic]
    end

    R[Router / Assignment Engine] <--> Bus
    Mon[Monitoring System] <-.heartbeats & metrics.-> Bus
    Reg[(Agent Registry)] <--> R

    subgraph Agents
        Ag1[Research Agents]
        Ag2[Engineering Agents]
        Ag3[Content Agents]
        Ag4[Data Agents]
        Ag5[Operations Agents]
        Ag6[Customer-Facing Agents]
        Ag7[Design Agents]
        Ag8[Orchestration/QA Agents]
    end

    Ag1 <--> T1
    Ag2 <--> T2
    Ag3 <--> T3
    Ag4 <--> T4
    Ag5 <--> T5
    Ag6 <--> T6
    Ag7 <--> T7
    Ag8 <--> T8

    Human[Human requester] --> R
    R --> Human
```

## 8.3 Standardized agent interface (per agent)

```mermaid
flowchart TB
    subgraph Agent[Any agent in the fleet - native or adapted]
        D["describe() → capabilities, category, tier"]
        Ac["accept(task) → accept / decline / conditional"]
        Ex["execute(task) → status updates + result"]
        He["health() → load, latency, error rate"]
    end

    Registry[Agent Registry] <-->|describe on onboarding| D
    Router[Assignment Engine] <-->|offer/accept| Ac
    Router -->|assigned task| Ex
    Ex --> Bus[Message Bus]
    Monitoring[Monitoring System] <-->|poll| He
```
