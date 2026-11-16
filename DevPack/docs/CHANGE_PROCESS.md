# User changes and task execution

The user wants new changes added as tasks and executed, without a new long prompt unless requested.

## Process

1. Capture the requested behavior in a short factual note. Identify whether it replaces a decision or adds scope.
2. Coordinator adds the next stable task ID (T049 onward), including acceptance, affected paths, dependencies and lane. Add a board record with truthful status.
3. Update the relevant specification/decision entry so future chats do not implement the old behavior.
4. Check active tasks. If affected, notify their owners and pause only conflicting writes. Independent work continues.
5. Assign the change when dependencies and ownership permit. Implement it under the same review/test/integration rules. User requests already authorize normal reversible implementation; do not request repeated confirmation.
6. Record completed behavior and regression evidence in CHANGELOG and the task handoff.

## Classification

- Small in-progress correction: record within that task if it does not alter accepted behavior elsewhere.
- New behavior or change to completed work: new task with links to affected tasks.
- Breaking shared interface: coordinated migration task; update both client/server, fixtures and protocol version together.
- Expanded platform/asset/hosting scope: record estimate and dependency impact; clarify only essential missing information. Purchases/access require the actual permissions available in the environment.

## Avoid drift

Do not silently make automatic running, free steering, firearms, player robber mode, a new city or photorealism part of the MVP. These are valid future requests but change the baseline. Mark superseded decisions; preserve why code was built a certain way. Do not equate a newly written task with completed implementation.

## Task record fields

ID, title, user request/source, scope, acceptance, dependencies, owner/lane, write paths, status, evidence and integration commit. Full implementation prompts are a separate optional deliverable only when the user asks.
