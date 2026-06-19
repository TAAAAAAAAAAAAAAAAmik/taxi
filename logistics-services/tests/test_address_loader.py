from app.services.address_loader import AddressLoaderService, AddressRecord


def test_address_normalized_key_removes_case_noise() -> None:
    left = AddressLoaderService.normalized_key("Малояз", "Коммунистическая улица", "65/1")
    right = AddressLoaderService.normalized_key("малояз", "коммунистическая улица", "65/1")

    assert left == right


def test_dedupe_prefers_record_with_coordinates() -> None:
    gar = AddressRecord(
        source="gar",
        source_id="gar-1",
        normalized_key="малояз|ленина|1",
        settlement="Малояз",
        street="Ленина",
        house_number="1",
        full_address="Салаватский район, Малояз, Ленина, дом 1",
    )
    osm = AddressRecord(
        source="osm",
        source_id="node:1",
        normalized_key="малояз|ленина|1",
        settlement="Малояз",
        street="Ленина",
        house_number="1",
        full_address="Салаватский район, Малояз, Ленина, дом 1",
        latitude=55.2,
        longitude=58.1,
    )

    records = AddressLoaderService._dedupe_records([gar, osm])

    assert records == [osm]

