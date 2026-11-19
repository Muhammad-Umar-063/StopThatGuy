# Batch 4 chat registry

Current status: T017–T019 integrated and accepted; T020 ready at updated main.
See integration/BATCH_4.md. Registration/base details below are historical.

Chat D started batch-4 coordination on 19 November 2026. The user has now
launched A/B/C; their fresh task prompts and active turns were verified via read_thread.
Register actual task, cwd, branch, HEAD and ID/host when each prompt is executed;
never treat an earlier task's chat ID as a current task assignment automatically.

| Role | Task | Chat ID / host | State |
|---|---|---|---|
| A | T017 | `01a1e9fa-a445-7d90-8f1d-1c33e5e389e5` / `local` | done; accepted on main |
| B | T018 | `01a1ea37-4368-7100-8cd9-6ad2f299df5d` / `local` | done; accepted on main |
| C | T019 | `01a1e9fc-6fb5-7000-9099-74cf86ed3055` / `local` | done; accepted on main |
| D / coordinator | T020 | `01a1ea31-eab3-7e02-a75c-948fa0e4986c` / `local` | T020 ready; gameplay not started |

Suggested chats to reuse (titles still describe older tasks): A “Implement T006 room
lifecycle”; B “Implement third-person camera”; C “Implement T008 asset workflow”;
D “Implement accessible lobby screens”. These IDs were registered from the new T017–T019 task launchers, not the old titles.
History: archive/BATCH_3_CHAT_REGISTRY.md. Use file mailboxes if chat tools/IDs are
unavailable; do not require a user ID relay just to implement preleased work.

D verification: runtime CODEX_THREAD_ID and app thread identity agree. Assigned cwd
`/home/umar/Downloads/StopThatGuy/.worktrees/T020/DevPack`, branch
`task/T020-online-chase`, clean HEAD/base `46811168fab6feab33858ff0830a8d0631273fa8`.
Main HEAD at startup: `3afa9760659a5b8c75ca0511bda73053db051795`. Direct chat discovery/read/send
tools are available in D; no worker message delivery is claimed at registration.

Worker registration: all three assigned task branches/HEADs match ACTIVE_WORK and
the accepted `46811168fab6feab33858ff0830a8d0631273fa8` base. Direct app reads confirm
the user invoked T017/T018/T019 in the corresponding IDs above; active startup turns
justify in_progress. Worker-owned mailboxes may lag during initial startup.

D sent one registration/scope notification to each verified T017/T018/T019 thread
via send_message_to_thread on local; all three calls returned success on
19 November 2026. This confirms delivery, not worker acceptance or completion.
