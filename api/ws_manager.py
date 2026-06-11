"""
WebSocket connection manager with Redis pub/sub for multi-instance deployments.

Single-instance mode (no REDIS_URL): in-memory broadcast, unchanged behaviour.
Multi-instance mode (REDIS_URL set): publishes to Redis channel ghost:ws:{run_id};
  all API instances subscribe and forward to their local connections.
"""
import asyncio
import json
import logging
from collections import defaultdict
from typing import Dict, Optional, Set

from fastapi import WebSocket

logger = logging.getLogger("ghost_author")


class ConnectionManager:
    def __init__(self):
        self._connections: Dict[str, Set[WebSocket]] = defaultdict(set)
        self._redis: Optional[object] = None
        self._pubsub_task: Optional[asyncio.Task] = None

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    async def startup(self, redis_url: Optional[str] = None) -> None:
        if not redis_url:
            logger.info("WebSocket manager: single-instance mode (no Redis)")
            return
        try:
            import redis.asyncio as aioredis
            self._redis = aioredis.from_url(redis_url, decode_responses=True)
            await self._redis.ping()
            self._pubsub_task = asyncio.create_task(self._subscriber_loop())
            logger.info("WebSocket manager: Redis pub/sub active")
        except Exception as e:
            logger.warning(f"Redis unavailable — WebSocket in single-instance mode: {e}")
            self._redis = None

    async def shutdown(self) -> None:
        if self._pubsub_task:
            self._pubsub_task.cancel()
            try:
                await self._pubsub_task
            except asyncio.CancelledError:
                pass
        if self._redis:
            await self._redis.aclose()

    # ── Redis subscriber ──────────────────────────────────────────────────────

    async def _subscriber_loop(self) -> None:
        """Pattern-subscribe to ghost:ws:* and forward messages to local connections."""
        pubsub = self._redis.pubsub()
        await pubsub.psubscribe("ghost:ws:*")
        try:
            async for message in pubsub.listen():
                if message.get("type") != "pmessage":
                    continue
                channel: str = message["channel"]
                run_id = channel.split(":")[-1]
                try:
                    data = json.loads(message["data"])
                    await self._send_local(run_id, data)
                except Exception as e:
                    logger.error(f"WS Redis forward error: {e}")
        except asyncio.CancelledError:
            pass
        finally:
            try:
                await pubsub.punsubscribe("ghost:ws:*")
            except Exception:
                pass

    # ── Connection management ─────────────────────────────────────────────────

    async def connect(self, run_id: str, ws: WebSocket) -> None:
        await ws.accept()
        self._connections[run_id].add(ws)
        logger.info(f"WS connected: run={run_id}, total={len(self._connections[run_id])}")

    def disconnect(self, run_id: str, ws: WebSocket) -> None:
        self._connections[run_id].discard(ws)
        if not self._connections[run_id]:
            del self._connections[run_id]

    # ── Broadcast ─────────────────────────────────────────────────────────────

    async def _publish(self, run_id: str, data: dict) -> None:
        """Publish to Redis (multi-instance) or send locally (single-instance)."""
        if self._redis:
            await self._redis.publish(f"ghost:ws:{run_id}", json.dumps(data))
        else:
            await self._send_local(run_id, data)

    async def _send_local(self, run_id: str, data: dict) -> None:
        text = json.dumps(data)
        dead: list = []
        for ws in list(self._connections.get(run_id, [])):
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(run_id, ws)

    async def broadcast(self, run_id: str, message: dict) -> None:
        await self._publish(run_id, message)

    async def broadcast_log(self, run_id: str, level: str, message: str) -> None:
        await self._publish(run_id, {
            "type": "log",
            "run_id": run_id,
            "payload": {"level": level, "message": message},
        })

    async def broadcast_status(self, run_id: str, status: str) -> None:
        await self._publish(run_id, {
            "type": "status",
            "run_id": run_id,
            "payload": {"status": status},
        })

    async def broadcast_complete(self, run_id: str, success: bool, pr_url: Optional[str]) -> None:
        await self._publish(run_id, {
            "type": "complete",
            "run_id": run_id,
            "payload": {"success": success, "pr_url": pr_url},
        })

    @property
    def active_run_ids(self) -> list:
        return list(self._connections.keys())


ws_manager = ConnectionManager()
