from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Park, ParkDriver, ParkVehicle
from app.schemas import (
    ParkDriverRegistrationRequest,
    ParkInviteRequest,
    ParkRegistrationRequest,
    ParkVehicleRequest,
    RoleRegistrationResponse,
    SelfEmployedRegistrationRequest,
)


class RoleService:
    """Registration helpers for the Kinetix role architecture."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def register_self_employed_driver(
        self,
        payload: SelfEmployedRegistrationRequest,
    ) -> RoleRegistrationResponse:
        """Accept a self-employed driver profile for document review."""

        return RoleRegistrationResponse(
            driver_id=payload.driver_id,
            role="self_employed_driver",
            status="documents_pending",
            user_id=payload.user_id,
        )

    async def register_park(self, payload: ParkRegistrationRequest) -> RoleRegistrationResponse:
        """Create a taxi park legal profile in pending status."""

        park = Park(
            contact_phone=payload.contact_phone,
            inn=payload.inn,
            legal_address=payload.legal_address,
            ogrn=payload.ogrn,
            organisation_name=payload.organisation_name,
            owner_user_id=payload.owner_user_id,
            settlement_account=payload.settlement_account,
            status="pending",
        )
        self.session.add(park)
        await self.session.commit()
        return RoleRegistrationResponse(
            park_id=park.id,
            role="park_admin",
            status=park.status,
            user_id=payload.owner_user_id,
        )

    async def create_driver_invite(self, park_id: str, payload: ParkInviteRequest) -> RoleRegistrationResponse:
        """Create a one-time invite code for a future taxi park driver."""

        park = await self.session.get(Park, park_id)
        if not park:
            raise ValueError("Park not found")

        invite = ParkDriver(
            invite_code=self._invite_code(park),
            invited_at=datetime.now(timezone.utc),
            park_id=park_id,
            status="invited",
        )
        self.session.add(invite)
        await self.session.commit()
        return RoleRegistrationResponse(
            invite_code=invite.invite_code,
            park_id=park_id,
            role="park_driver",
            status=invite.status,
            user_id="",
        )

    async def register_park_driver(self, payload: ParkDriverRegistrationRequest) -> RoleRegistrationResponse:
        """Attach a user to a taxi park by invite code."""

        invite = await self.session.scalar(
            select(ParkDriver).where(
                ParkDriver.invite_code == payload.invite_code.upper(),
                ParkDriver.status == "invited",
            ),
        )
        if not invite:
            raise ValueError("Invite not found or already used")

        invite.user_id = payload.user_id
        invite.driver_id = payload.driver_id
        invite.updated_at = datetime.now(timezone.utc)
        await self.session.commit()
        return RoleRegistrationResponse(
            driver_id=payload.driver_id,
            park_id=invite.park_id,
            role="park_driver",
            status=invite.status,
            user_id=payload.user_id,
        )

    async def add_vehicle(self, park_id: str, payload: ParkVehicleRequest) -> ParkVehicle:
        """Add a vehicle to a taxi park fleet."""

        vehicle = ParkVehicle(
            brand=payload.brand,
            driver_id=payload.driver_id,
            model=payload.model,
            park_id=park_id,
            plate=payload.plate,
            sts_number=payload.sts_number,
            status="active",
        )
        self.session.add(vehicle)
        await self.session.commit()
        return vehicle

    @staticmethod
    def _invite_code(park: Park) -> str:
        suffix = uuid4().hex[:8].upper()
        prefix = "".join(ch for ch in park.inn if ch.isdigit())[-4:] or "PARK"
        return f"PARK-{prefix}-{suffix}"
