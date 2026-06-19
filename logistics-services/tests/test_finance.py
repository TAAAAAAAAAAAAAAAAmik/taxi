from decimal import Decimal

from app.services.finance import FinanceService


def test_commission_is_zero_for_monthly_driver() -> None:
    assert FinanceService._commission(Decimal("1000.00"), "monthly") == Decimal("0.00")


def test_commission_is_seven_percent_for_commission_driver() -> None:
    assert FinanceService._commission(Decimal("1000.00"), "commission") == Decimal("70.00")
    assert FinanceService._commission(Decimal("333.33"), "commission") == Decimal("23.33")
