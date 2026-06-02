from decimal import Decimal

from app.services.surge import SurgePricingService


def test_surge_coefficient_thresholds() -> None:
    assert SurgePricingService._coefficient(3, 2, Decimal("1.500")) == Decimal("1.0")
    assert SurgePricingService._coefficient(4, 2, Decimal("2.000")) == Decimal("1.2")
    assert SurgePricingService._coefficient(5, 2, Decimal("2.500")) == Decimal("1.5")
    assert SurgePricingService._coefficient(7, 2, Decimal("3.500")) == Decimal("2.0")
    assert SurgePricingService._coefficient(1, 0, Decimal("1.000")) == Decimal("2.0")


def test_surge_ratio_handles_zero_supply() -> None:
    assert SurgePricingService._ratio(0, 0) == Decimal("1")
    assert SurgePricingService._ratio(3, 0) == Decimal("3")
    assert SurgePricingService._ratio(3, 2) == Decimal("1.500")

