import asyncio
import contextlib

from redis.exceptions import ResponseError

from app.core.config import get_settings
from app.core.db import AsyncSessionLocal
from app.core.node_client import NodeBackendClient
from app.core.redis import make_redis
from app.services.order_processor import OrderProcessor


async def consume_forever() -> None:
    """Consume pending_orders with Redis consumer groups and ack only after processing."""

    settings = get_settings()
    redis = make_redis()
    node = NodeBackendClient()
    await ensure_group(redis, settings.dispatch_stream, settings.dispatch_consumer_group)

    try:
        while True:
            items = await redis.xreadgroup(
                groupname=settings.dispatch_consumer_group,
                consumername=settings.dispatch_consumer_name,
                streams={settings.dispatch_stream: ">"},
                count=25,
                block=5_000,
            )
            if not items:
                continue

            stream_entries = items[0][1]
            batch_messages: list[tuple[str, dict[str, str]]] = []
            single_messages: list[tuple[str, dict[str, str]]] = []

            for message_id, fields in stream_entries:
                if fields.get("mode") == "batch":
                    batch_messages.append((message_id, fields))
                else:
                    single_messages.append((message_id, fields))

            async with AsyncSessionLocal() as session:
                processor = OrderProcessor(redis, session, node, settings)
                for message_id, fields in single_messages:
                    await processor.process_order(fields)
                    await redis.xack(settings.dispatch_stream, settings.dispatch_consumer_group, message_id)

                if batch_messages:
                    await processor.process_batch([fields for _, fields in batch_messages])
                    await redis.xack(
                        settings.dispatch_stream,
                        settings.dispatch_consumer_group,
                        *[message_id for message_id, _ in batch_messages],
                    )
    finally:
        await node.close()
        await redis.aclose()


async def ensure_group(redis, stream: str, group: str) -> None:
    """Create the Redis consumer group if it does not exist yet."""

    with contextlib.suppress(ResponseError):
        await redis.xgroup_create(stream, group, id="0", mkstream=True)


def main() -> None:
    """CLI entrypoint for running the stream consumer."""

    asyncio.run(consume_forever())


if __name__ == "__main__":
    main()

