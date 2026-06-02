from collections.abc import AsyncIterator
from decimal import Decimal
from typing import Any

import httpx

from app.core.config import Settings, get_settings


class NodeBackendError(RuntimeError):
    """Raised when the Node.js backend rejects a logistics callback."""


class NodeBackendClient:
    """Thin async client for callbacks into the existing Node.js backend."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self._client = httpx.AsyncClient(
            base_url=self.settings.node_base_url,
            timeout=self.settings.node_timeout_seconds,
        )

    async def close(self) -> None:
        """Close the underlying HTTP client."""

        await self._client.aclose()

    async def assign_order(
        self,
        order_id: str,
        driver_id: str,
        park_id: str | None = None,
        fulfilled_by_role: str | None = None,
        batch_id: str | None = None,
    ) -> dict[str, Any]:
        """Assign an order to a driver through Node."""

        return await self._request(
            "PATCH",
            f"/orders/{order_id}/assign",
            {
                "batchId": batch_id,
                "driverId": driver_id,
                "fulfilledByRole": fulfilled_by_role,
                "parkId": park_id,
            },
        )

    async def update_order_status(self, order_id: str, status: str) -> dict[str, Any]:
        """Patch an order status through Node."""

        return await self._request("PATCH", f"/orders/{order_id}/status", {"status": status})

    async def update_order_payment(
        self,
        order_id: str,
        payment_status: str,
        note: str,
        actor: str = "logistics-finance",
    ) -> dict[str, Any]:
        """Patch an order payment status through Node."""

        return await self._request(
            "PATCH",
            f"/orders/{order_id}/payment",
            {"actor": actor, "note": note, "paymentStatus": payment_status},
        )

    async def send_driver_offer(self, order_id: str, driver_id: str, payload: dict[str, Any]) -> dict[str, Any]:
        """Ask Node to push a dispatch offer to the driver."""

        return await self._request(
            "POST",
            "/internal/dispatch/offers",
            {"driverId": driver_id, "orderId": order_id, **payload},
        )

    async def charge_client(self, order_id: str, amount: Decimal, payload: dict[str, Any]) -> dict[str, Any]:
        """Ask Node billing to capture the customer payment."""

        return await self._request(
            "POST",
            "/internal/billing/client-charge",
            {"amount": str(amount), "orderId": order_id, **payload},
        )

    async def credit_driver(self, driver_id: str, amount: Decimal, payload: dict[str, Any]) -> dict[str, Any]:
        """Ask Node billing to credit the driver's internal balance."""

        return await self._request(
            "POST",
            "/internal/billing/driver-credit",
            {"amount": str(amount), "driverId": driver_id, **payload},
        )

    async def send_notification(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Ask Node to deliver an internal notification through its realtime layer."""

        return await self._request("POST", "/internal/notifications", payload)

    async def check_marketing_thresholds(self) -> dict[str, Any]:
        """Ask Node marketing ledger to re-check driver order thresholds."""

        return await self._request("POST", "/internal/marketing/check-thresholds", {})

    async def accrue_monthly_marketing_location_bonuses(self) -> dict[str, Any]:
        """Ask Node marketing ledger to accrue monthly top-location bonuses."""

        return await self._request("POST", "/internal/marketing/monthly-location-bonuses", {})

    async def _request(self, method: str, path: str, json: dict[str, Any] | None = None) -> Any:
        response = await self._client.request(method, path, json=json, headers=self._headers())
        payload = response.json() if response.content else {}
        if response.status_code >= 400:
            message = payload.get("error") if isinstance(payload, dict) else response.text
            raise NodeBackendError(message or f"Node backend request failed: {response.status_code}")
        return payload

    def _headers(self) -> dict[str, str]:
        headers = {"accept": "application/json", "content-type": "application/json"}
        if self.settings.node_internal_token:
            headers["x-internal-token"] = self.settings.node_internal_token
        return headers


async def get_node_client() -> AsyncIterator[NodeBackendClient]:
    """Yield a Node backend client for FastAPI dependency injection."""

    client = NodeBackendClient()
    try:
        yield client
    finally:
        await client.close()
