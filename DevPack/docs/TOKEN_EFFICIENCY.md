# Token-efficient development

## Objective

Minimize repeated context, duplicated implementation and avoidable rework while meeting the task acceptance criteria. The full pack is reference material, not something every chat should ingest on every task. Token savings are a design goal, not a measured percentage or guaranteed bill.

## Read only the needed context

At first use, load the short shared instructions, current decisions and parallel-work rules. For each task, load its single backlog entry, active ownership, relevant spec sections and affected code. Search filenames/symbols with targeted tools before reading entire directories or files. Use Git diffs to identify changes since the last known commit. Never omit a required instruction merely to save tokens.

| Work area | Primary references beyond shared instructions |
|---|---|
| Movement / camera / touch | CONTROLS; relevant CONTRACTS and movement rules |
| AI / vehicles / crime / police | Relevant GAMEPLAY sections; simulation contracts; CITY routes |
| Networking | NETWORKING; CONTRACTS; relevant ARCHITECTURE sections |
| Art / animation / performance | GRAPHICS; ASSETS; relevant CITY and world contracts |
| UI | UI contracts; relevant CONTROLS, GAMEPLAY and accessibility checks |
| Integration / release | Current dependencies/handoffs; TESTING; DEPLOYMENT when applicable |

Read more when interfaces, uncertainty or failures require it. Do not blindly restrict an agent to a file count. Workers need the relevant task/dependency records, not all 48 board records. The coordinator can inspect the whole board when scheduling.

## Work and report efficiently

- Implement one coherent task at a time. Do not ask two assistants to independently solve the same task.
- Use small patches to existing files. Avoid rewriting working modules, regenerating the repository or re-explaining approved architecture.
- Batch independent searches/checks where practical; keep edits and dependent steps sequential.
- Limit tool output to relevant matches, failure details and summaries. Store long logs as files and inspect the relevant section.
- Provide brief progress updates when useful; do not narrate every tool call.
- Handoffs should normally be about 150–250 words, with paths/commit IDs, actual verification and unresolved issues. Use more detail when needed to explain a material risk.
- Do not paste complete source files into handoffs when the next chat can access the repository.
- If repeated attempts fail, inspect the failure and narrow the hypothesis before trying more edits. Avoid speculative fix loops.

## Verification without duplication

Run meaningful checks for the affected behavior and all mandatory project checks at their required gate. Run broader regression at integration/release or when changes justify it. Do not repeat an unchanged successful expensive check without a reason. Never skip concurrency, authority, collision or device checks merely to reduce tokens.

Use a second assistant for important shared-contract changes, multiplayer authority, security/validation, tricky state transitions or unresolved defects. Routine text/asset-label edits can use direct verification and normal integration review. A reviewer reads the diff and relevant context, not automatically the entire repository, and does not independently rebuild the feature.

## Parallel chats

Three or four chats improve elapsed-time throughput only when tasks are independent; they may increase total tokens because each needs context. Start with one chat for foundation tasks, then two active implementation chats as ready work allows. Add a third/fourth when there is a clear independent task and file ownership. An idle lane need not generate status messages or speculative work.

Keep each chat focused on its lane, but create a fresh chat when context becomes stale or dominated by unrelated history. Transfer a compact handoff, current task, integrated commit and relevant files rather than the whole conversation. Do not assume a fresh chat inherits another chat's files or memory.

## Prompts and tracking

Only generate a full prompt when the user requests it. Future prompts should reference repository files, task ID and acceptance rather than repeat this pack. For tools without repository access, provide the minimum necessary file excerpts explicitly. Do not rely on unavailable context.

If the service exposes usage, record actual per-task usage/cost and compare it with review/fix effort. Do not estimate billing from document word count or promise fixed savings. Required quality and truthful completion remain the stopping criteria.
