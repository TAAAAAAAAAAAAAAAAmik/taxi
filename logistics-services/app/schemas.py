from decimal import Decimal
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

DriverAvailabilityStatus = Literal["online", "offline", "busy"]
DispatchMode = Literal["greedy", "batch"]
AccountRole = Literal["client", "self_employed_driver", "park_admin", "park_driver", "marketer"]
SubscriptionType = Literal["driver_monthly", "park_monthly"]


class GeoPoint(BaseModel):
    """Latitude/longitude pair."""

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class SurgeQuoteRequest(BaseModel):
    """Request for a pre-order surge quote."""

    base_price: Decimal = Field(gt=0)
    customer_id: str | None = None
    pickup: GeoPoint
    quote_id: str | None = None
    zone_id: str | None = None


class SurgeQuoteResponse(BaseModel):
    """Calculated surge quote returned before order creation."""

    base_price: Decimal
    coefficient: Decimal
    demand_pins: int
    final_price: Decimal
    free_drivers: int
    quote_id: str
    ratio: Decimal
    zone_id: str


class DriverLocationRequest(BaseModel):
    """Driver location update for Redis GEO indexes."""

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    status: DriverAvailabilityStatus
    can_receive_orders: bool = True
    driver_role: Literal["self_employed_driver", "park_driver"] = "self_employed_driver"
    park_id: str | None = None


class DriverLocationResponse(BaseModel):
    """Response after updating a driver location."""

    driver_id: str
    indexed_as_free: bool
    status: DriverAvailabilityStatus


class NearbyDriver(BaseModel):
    """Driver returned from Redis GEO search."""

    driver_id: str
    distance_meters: float
    latitude: float
    longitude: float
    driver_role: Literal["self_employed_driver", "park_driver"] = "self_employed_driver"
    park_id: str | None = None
    status: DriverAvailabilityStatus


class NearbyDriversResponse(BaseModel):
    """Nearest free drivers for a pickup point."""

    drivers: list[NearbyDriver]


class DispatchEnqueueRequest(BaseModel):
    """Order enqueue request from Node or admin tooling."""

    mode: DispatchMode | None = None
    order: dict[str, Any] = Field(default_factory=dict)
    pickup: GeoPoint


class DispatchEnqueueResponse(BaseModel):
    """Response after placing an order into the dispatch stream."""

    enqueued: bool
    mode: DispatchMode
    order_id: str
    stream_id: str


class DriverOfferResponseRequest(BaseModel):
    """Driver answer to a pending dispatch offer."""

    decision: Literal["accepted", "rejected"]
    reason: str | None = None


class FinanceSettlementRequest(BaseModel):
    """Trip settlement payload after an order reaches completed status."""

    amount: Decimal = Field(gt=0)
    billing_mode: Literal["monthly", "commission", "park_monthly"]
    client_id: str
    driver_id: str
    idempotency_key: str | None = None
    payment_method: str = "card"
    provider_payload: dict[str, Any] = Field(default_factory=dict)


class FinanceSettlementResponse(BaseModel):
    """Outcome of a trip settlement attempt."""

    client_debt_created: bool = False
    commission_amount: Decimal
    compensated: bool = False
    driver_amount: Decimal
    order_id: str
    retry_scheduled: bool = False
    status: Literal["settled", "compensated", "already_settled"]


class AddressImportRequest(BaseModel):
    """Manual Salavat district import request."""

    dry_run: bool = False
    include_gar: bool = True
    include_osm: bool = True
    max_records: int | None = Field(default=None, ge=1)


class AddressImportResponse(BaseModel):
    """Summary for a Salavat address import run."""

    added: int
    dry_run: bool
    gar_seen: int = 0
    osm_seen: int = 0
    redis_indexed: int = 0
    skipped_existing: int = 0


class AddressPointRequest(BaseModel):
    """Admin-created or edited Salavat district address/POI."""

    category: str = "address"
    contract_status: str = "draft"
    full_address: str
    house_number: str = ""
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    marketer_id: str | None = None
    qr_code_id: str | None = None
    settlement: str = ""
    source_id: str | None = None
    street: str = ""


class AddressPointResponse(BaseModel):
    """Address point returned to admin tooling and search sync."""

    contract_status: str
    full_address: str
    house_number: str
    id: str
    install_count: int
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    marketer_id: str | None = None
    qr_code_id: str | None = None
    settlement: str
    source: str
    street: str
    updated_at: datetime


class MarketingActionResponse(BaseModel):
    """Victory Points ledger item."""

    base_points: Decimal
    description: str
    id: str
    marketer_id: str
    points: Decimal
    source_id: str
    status: str
    type: str


class SelfEmployedRegistrationRequest(BaseModel):
    """Registration payload for a self-employed driver profile."""

    user_id: str
    driver_id: str | None = None
    passport_series_number: str
    driver_inn: str
    driver_license: str
    sts_number: str
    osago_number: str | None = None
    tax_status: str


class ParkRegistrationRequest(BaseModel):
    """Legal profile payload for a taxi park."""

    owner_user_id: str
    organisation_name: str
    inn: str
    ogrn: str
    legal_address: str
    contact_phone: str
    settlement_account: str


class ParkInviteRequest(BaseModel):
    """Create an invitation for a taxi park driver."""

    contact: str | None = None


class ParkDriverRegistrationRequest(BaseModel):
    """Attach a user to a taxi park by invitation code."""

    user_id: str
    driver_id: str | None = None
    invite_code: str
    driver_license: str
    driving_experience_since: int


class RoleRegistrationResponse(BaseModel):
    """Common response for role registration helpers."""

    role: AccountRole
    status: str
    user_id: str
    driver_id: str | None = None
    park_id: str | None = None
    invite_code: str | None = None


class SubscriptionStatusResponse(BaseModel):
    """Subscription state for a driver or park."""

    active: bool
    amount: Decimal
    expires_at: datetime | None = None
    owner_id: str
    status: str
    type: SubscriptionType


class SubscriptionActivationRequest(BaseModel):
    """Payment confirmation payload from billing provider callbacks."""

    provider_payment_id: str | None = None
    starts_at: datetime | None = None


class ParkVehicleRequest(BaseModel):
    """Create or update a park vehicle."""

    brand: str
    model: str
    plate: str
    sts_number: str
    driver_id: str | None = None


class ParkDashboardResponse(BaseModel):
    """Taxi park cabinet summary."""

    active_drivers: int
    commission_amount: Decimal
    orders_total: int
    park_id: str
    revenue: Decimal
    subscription_active: bool
