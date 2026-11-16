# Deployment plan

No provider, paid account or public deployment exists yet. Select these in T045 based on available accounts, region and budget.

## Shape

Static client build on an HTTPS host/CDN. Persistent Node.js process for Colyseus and WSS. One instance initially; in-memory rooms end on process restart. Do not deploy sockets into a service whose request lifetime cannot support them. Container packaging is optional, based on hosting needs.

## Configuration contract

Client public configuration: server endpoint, build/protocol version, public asset base if needed. Server configuration: port, allowed origins, environment/log level, room/tick limits, protocol/world/config version. Names and exact commands are established in T001/T045 and added to .env.example without secrets. Public client variables are not secret storage.

## Local / staging / production

Local: client dev server plus game server; documented start command and usable default port selection. Staging: version-paired HTTPS/WSS deployment for realistic tests. Production: same validated build/config, with explicit release record and rollback artifact. Current task authorization determines whether preparing or publishing is requested; do not confuse them.

## Operational checks

Health/readiness endpoints; structured room/error logs without session secrets; connection limits; idle room cleanup; process restart behavior; graceful shutdown warning when feasible; client explanation after unexpected server loss. Log enough to diagnose match IDs and errors without collecting unnecessary personal data.

## Release procedure

Pin dependencies → clean install/check/build → validate assets/world → deploy staging pair → run external-browser tests → record user playtest → fix blocking issues → publish selected version pair → smoke test production → record URLs, versions, rollback steps and known limits.

T045 prepares configuration and packaging. T046 may deploy staging when assigned and access is available. T048 performs the authorized public release; paid purchases, missing credentials and access limitations must be surfaced rather than invented.

## Scale limits

Six players per room is a feature limit, not a tested server capacity. Benchmark concurrent rooms before advertising capacity. Do not add Redis, distributed matchmaking or a database before evidence and an assigned task justify them.
