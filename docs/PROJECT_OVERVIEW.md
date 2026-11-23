# Project Overview — inch

## What is inch?

**inch** (previously named **Argupedia** in the academic specification) is a structured online debate platform built on formal argumentation theory. Unlike conventional forums (Reddit, comment threads) where arguments are expressed as unstructured free text, inch requires all arguments to be constructed using predefined **argumentation schemes** (Walton) and challenged through explicit **critical questions**.

The platform represents debates as formal **argument graphs** that can be evaluated computationally using abstract argumentation semantics (Dung). This allows users to see which arguments are currently "winning" or "losing" based on structure alone — not popularity, rhetoric, or voting.

## Renamed Project Context

The original project specification refers to the system as **Argupedia**. The implementation is called **inch** throughout the code and documentation.

## Core Concepts

### Hierarchical Debate Structure

Debates are organised in a strict hierarchy:

```
Topic
  └── Subtopic
        └── Initial Argument
              ├── Counter-Argument
              │     └── Counter-Argument (arbitrarily deep)
              └── Counter-Argument
```

- **Topic**: A high-level subject of discussion (e.g., "Climate Policy").
- **Subtopic**: A specific aspect within a topic (e.g., "Carbon Taxation").
- **Initial Argument**: An argument attached directly to a subtopic. These are entry points into the argument graph (`is_initial = true`).
- **Counter-Argument**: An argument that attacks an existing argument by raising a critical question associated with the target's scheme (`is_initial = false`).

Topics and subtopics are **organisational containers only** — they do not participate in argument evaluation.

### Argument Graph Model

- **Nodes** = arguments (each an instantiated argumentation scheme with variable values).
- **Directed edges** = attack relationships between arguments.
- Initial arguments act as **root nodes** within a subtopic-scoped graph.
- Counter-arguments may themselves be attacked, enabling arbitrarily deep argumentative structures.

### Argument Statuses

Each argument is assigned a status based on structural evaluation using formal argumentation semantics:

| Status | Meaning |
|--------|---------|
| `in` | The argument is currently accepted (not successfully attacked) |
| `out` | The argument is currently defeated (successfully attacked) |
| `undecided` | The argument's status cannot be determined |

Statuses are **re-evaluated immediately** when a new argument or counter-argument is submitted.

### Key Constraint: LLM Boundaries

> **LLMs must NOT generate, modify, or evaluate arguments.** Any use of LLMs is **strictly limited** to rendering existing structured arguments into natural language form for improved readability (FR15).

This is a fundamental design principle — argument creation and evaluation are always user-driven and structure-based.

## Relationship to AIF

The argument model is informed by the **Argument Interchange Format (AIF)**. inch adopts a **collapsed representation** where an argument is a single composite entity (scheme + variables), corresponding to collapsed AIF I-nodes and S-nodes. This simplifies the user experience while remaining conceptually compatible with AIF for potential future export.

## Project Author

- **Author**: Shah Anwar
- **Supervisor**: Dr Sanjay Modgil
- **Institution**: King's College London, Department of Informatics
