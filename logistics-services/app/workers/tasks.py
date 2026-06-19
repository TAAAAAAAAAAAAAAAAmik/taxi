import asyncio
from decimal import Decimal

from app.core.db import AsyncSessionLocal
from app.core.node_client import NodeBackendClient, NodeBackendError
from app.core.redis import make_redis
from app.schemas import AddressImportRequest
from app.services.address_loader import AddressLoaderService
from app.services.billing import BillingService
from app.services.finance import MONEY
from app.services.order_processor import OrderProcessor
from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.tasks.process_order")
def process_order(message: dict[str, str]) -> dict:
    """Celery task wrapper for processing one pending order."""

    return asyncio.run(_process_order(message))


async def _process_order(message: dict[str, str]) -> dict:
    redis = make_redis()
    node = NodeBackendClient()
    try:
        async with AsyncSessionLocal() as session:
            result = await OrderProcessor(redis, session, node).process_order(message)
            return {
                "batch_id": result.batch_id,
                "driver_id": result.driver_id,
                "order_id": result.order_id,
                "status": result.status,
            }
    finally:
        await node.close()
        await redis.aclose()


@celery_app.task(name="app.workers.tasks.import_salavat_addresses")
def import_salavat_addresses() -> dict:
    """Periodic Celery Beat task for Salavat district address import."""

    return asyncio.run(_import_salavat_addresses())


async def _import_salavat_addresses() -> dict:
    redis = make_redis()
    try:
        async with AsyncSessionLocal() as session:
            result = await AddressLoaderService(session, redis).import_salavat(AddressImportRequest())
            return result.model_dump()
    finally:
        await redis.aclose()


@celery_app.task(name="app.workers.tasks.check_expiring_subscriptions")
def check_expiring_subscriptions() -> dict:
    """Notify owners whose monthly subscriptions expire in the next 3 days."""

    return asyncio.run(_check_expiring_subscriptions())


async def _check_expiring_subscriptions() -> dict:
    node = NodeBackendClient()
    notified = 0
    expired = 0
    try:
        async with AsyncSessionLocal() as session:
            billing = BillingService(session)
            expiring = await billing.expiring_in_days(days=3)
            expired = await billing.expire_overdue_subscriptions()
            for subscription in expiring:
                owner_id = subscription.park_id or subscription.user_id or ""
                await node.send_notification(
                    {
                        "audience": "driver" if subscription.user_id else "all",
                        "kind": "subscription_expiring",
                        "parkId": subscription.park_id,
                        "title": "Подписка скоро закончится",
                        "body": (
                            f"Подписка {subscription.type} активна до "
                            f"{subscription.expires_at.isoformat()}. Продлите доступ заранее."
                        ),
                        "userId": subscription.user_id,
                        "ownerId": owner_id,
                    },
                )
                notified += 1
        return {"expired": expired, "notified": notified}
    finally:
        await node.close()


@celery_app.task(name="app.workers.tasks.check_marketing_thresholds")
def check_marketing_thresholds() -> dict:
    """Re-check marketer driver thresholds such as 5th and 20th completed order."""

    return asyncio.run(_check_marketing_thresholds())


async def _check_marketing_thresholds() -> dict:
    node = NodeBackendClient()
    try:
        return await node.check_marketing_thresholds()
    finally:
        await node.close()


@celery_app.task(name="app.workers.tasks.accrue_monthly_marketing_location_bonuses")
def accrue_monthly_marketing_location_bonuses() -> dict:
    """Accrue the monthly +150 VP bonus for locations with 50+ installs."""

    return asyncio.run(_accrue_monthly_marketing_location_bonuses())


async def _accrue_monthly_marketing_location_bonuses() -> dict:
    node = NodeBackendClient()
    try:
        return await node.accrue_monthly_marketing_location_bonuses()
    finally:
        await node.close()


@celery_app.task(name="app.workers.tasks.retry_client_charge")
def retry_client_charge(order_id: str, settlement_payload: dict) -> dict:
    """Retry customer capture after driver autocompensation created a debt."""

    return asyncio.run(_retry_client_charge(order_id, settlement_payload))


async def _retry_client_charge(order_id: str, settlement_payload: dict) -> dict:
    node = NodeBackendClient()
    try:
        amount = Decimal(str(settlement_payload["amount"])).quantize(MONEY)
        response = await node.charge_client(
            order_id,
            amount,
            {
                "clientId": settlement_payload.get("client_id"),
                "debtRetry": True,
                "idempotencyKey": f"finance:retry:{order_id}",
                "paymentMethod": settlement_payload.get("payment_method", "card"),
                "providerPayload": settlement_payload.get("provider_payload", {}),
            },
        )
        await node.update_order_payment(order_id, "paid", "Client debt retry captured")
        return {"order_id": order_id, "status": "paid", "response": response}
    except NodeBackendError as error:
        return {"error": str(error), "order_id": order_id, "status": "retry_failed"}
    finally:
        await node.close()
