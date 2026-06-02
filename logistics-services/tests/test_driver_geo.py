import pytest

from app.schemas import DriverLocationRequest
from app.services.driver_geo import DriverGeoService


class FakeRedis:
    def __init__(self) -> None:
        self.commands = []
        self.hashes = {}
        self.removed = []

    async def hset(self, key, mapping):
        self.hashes.setdefault(key, {}).update(mapping)

    async def hgetall(self, key):
        return self.hashes.get(key, {})

    async def execute_command(self, *args):
        self.commands.append(args)
        if args[0] == "GEOSEARCH":
            return [["driver-1", "42.5", ["58.1", "55.2"]]]
        return 1

    async def zrem(self, key, member):
        self.removed.append((key, member))


@pytest.mark.asyncio
async def test_update_location_indexes_free_driver() -> None:
    redis = FakeRedis()
    service = DriverGeoService(redis)
    indexed = await service.update_location(
        "driver-1",
        DriverLocationRequest(latitude=55.2, longitude=58.1, status="online"),
    )

    assert indexed is True
    assert redis.hashes["driver:driver-1:status"]["status"] == "online"
    assert ("GEOADD", "drivers:geo:free", 58.1, 55.2, "driver-1") in redis.commands


@pytest.mark.asyncio
async def test_nearby_filters_non_free_driver() -> None:
    redis = FakeRedis()
    service = DriverGeoService(redis)
    redis.hashes["driver:driver-1:status"] = {"status": "busy", "can_receive_orders": "1"}

    drivers = await service.nearby_free_drivers(55.2, 58.1, 1_000)

    assert drivers == []
    assert ("drivers:geo:free", "driver-1") in redis.removed

