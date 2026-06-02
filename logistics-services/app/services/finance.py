from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.node_client import NodeBackendClient, NodeBackendError
from app.models import DriverBalance, FinanceEvent
from app.schemas import FinanceSettlementRequest, FinanceSettlementResponse

MONEY = Decimal("0.01")


class FinanceService:
    """Settle completed trips with commission, driver credit, and autocompensation."""

    def __init__(self, session: AsyncSession, node_client: NodeBackendClient) -> None:
        self.session = session
        self.node = node_client

    async def settle_order(self, order_id: str, payload: FinanceSettlementRequest) -> FinanceSettlementResponse:
        """Capture customer payment and credit driver balance idempotently."""

        idempotency_key = payload.idempotency_key or f"finance:settle:{order_id}"
        existing = await self._find_event(idempotency_key)
        if existing and existing.status in {"settled", "compensated"}:
            return FinanceSettlementResponse(
                client_debt_created=existing.status == "compensated",
                commission_amount=existing.commission_amount,
                compensated=existing.status == "compensated",
                driver_amount=existing.driver_amount,
                order_id=order_id,
                retry_scheduled=existing.status == "compensated",
                status="already_settled",
            )

        gross_amount = payload.amount.quantize(MONEY, rounding=ROUND_HALF_UP)
        commission_amount = self._commission(gross_amount, payload.billing_mode)
        driver_amount = (gross_amount - commission_amount).quantize(MONEY, rounding=ROUND_HALF_UP)

        try:
            charge = await self.node.charge_client(
                order_id,
                gross_amount,
                {
                    "clientId": payload.client_id,
                    "idempotencyKey": idempotency_key,
                    "paymentMethod": payload.payment_method,
                    "providerPayload": payload.provider_payload,
                },
            )
            await self._credit_driver(payload.driver_id, driver_amount, order_id, False, {"charge": charge})
            await self.node.update_order_payment(order_id, "paid", "Client payment captured and driver balance credited")
            await self._record_event(
                order_id,
                "settlement_completed",
                payload.driver_id,
                payload.client_id,
                gross_amount,
                commission_amount,
                driver_amount,
                "settled",
                {"billing_mode": payload.billing_mode},
                idempotency_key,
            )
            return FinanceSettlementResponse(
                commission_amount=commission_amount,
                driver_amount=driver_amount,
                order_id=order_id,
                status="settled",
            )
        except NodeBackendError as error:
            await self._credit_driver(payload.driver_id, driver_amount, order_id, True, {"charge_error": str(error)})
            await self._record_event(
                order_id,
                "client_debt_created",
                payload.driver_id,
                payload.client_id,
                gross_amount,
                commission_amount,
                driver_amount,
                "compensated",
                {"billing_mode": payload.billing_mode, "error": str(error)},
                idempotency_key,
            )
            retry_scheduled = self._schedule_retry(order_id, payload)
            try:
                await self.node.update_order_payment(
                    order_id,
                    "failed",
                    "Client charge failed; driver autocompensation created and debt scheduled",
                )
            except NodeBackendError:
                pass
            return FinanceSettlementResponse(
                client_debt_created=True,
                commission_amount=commission_amount,
                compensated=True,
                driver_amount=driver_amount,
                order_id=order_id,
                retry_scheduled=retry_scheduled,
                status="compensated",
            )

    async def _credit_driver(
        self,
        driver_id: str,
        amount: Decimal,
        order_id: str,
        compensation: bool,
        payload: dict,
    ) -> None:
        balance = await self.session.get(DriverBalance, driver_id)
        if not balance:
            balance = DriverBalance(driver_id=driver_id)
            self.session.add(balance)

        balance.available_amount = (balance.available_amount + amount).quantize(MONEY, rounding=ROUND_HALF_UP)
        if compensation:
            balance.compensated_amount = (balance.compensated_amount + amount).quantize(MONEY, rounding=ROUND_HALF_UP)
        balance.updated_at = datetime.now(timezone.utc)
        await self.session.flush()

        try:
            await self.node.credit_driver(driver_id, amount, {"compensation": compensation, "orderId": order_id, **payload})
        except NodeBackendError as error:
            await self._record_event(
                order_id,
                "driver_credit_callback_failed",
                driver_id,
                None,
                amount,
                Decimal("0.00"),
                amount,
                "warning",
                {"error": str(error), "compensation": compensation},
                None,
            )

    async def _record_event(
        self,
        order_id: str,
        event_type: str,
        driver_id: str | None,
        client_id: str | None,
        gross_amount: Decimal,
        commission_amount: Decimal,
        driver_amount: Decimal,
        status: str,
        payload: dict,
        idempotency_key: str | None,
    ) -> None:
        self.session.add(
            FinanceEvent(
                client_id=client_id,
                commission_amount=commission_amount,
                created_at=datetime.now(timezone.utc),
                driver_amount=driver_amount,
                driver_id=driver_id,
                event_type=event_type,
                gross_amount=gross_amount,
                idempotency_key=idempotency_key,
                order_id=order_id,
                payload=payload,
                status=status,
            ),
        )
        await self.session.commit()

    async def _find_event(self, idempotency_key: str) -> FinanceEvent | None:
        return await self.session.scalar(select(FinanceEvent).where(FinanceEvent.idempotency_key == idempotency_key))

    @staticmethod
    def _commission(amount: Decimal, billing_mode: str) -> Decimal:
        if billing_mode == "commission":
            return (amount * Decimal("0.07")).quantize(MONEY, rounding=ROUND_HALF_UP)

        return Decimal("0.00")

    @staticmethod
    def _schedule_retry(order_id: str, payload: FinanceSettlementRequest) -> bool:
        try:
            from app.workers.tasks import retry_client_charge

            retry_client_charge.apply_async(args=[order_id, payload.model_dump(mode="json")], countdown=300)
            return True
        except Exception:
            return False
