"""Ticket S28-C1 (session 28, 14 Oct 2026; issue #864): CI collects each test in exactly one shard, a
check that compares the shards' collected node ids proves it, and the web's slowed Vitest pass runs as
its own job in parallel while the required `web` check still fails when it fails."""
