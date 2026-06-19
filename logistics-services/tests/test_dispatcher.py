from math import inf

from app.services.dispatcher import DispatcherService
from app.services.driver_geo import DriverCandidate


def make_driver(driver_id: str, distance: float) -> DriverCandidate:
    return DriverCandidate(
        driver_id=driver_id,
        distance_meters=distance,
        latitude=55.2,
        longitude=58.1,
        status="online",
    )


def test_cost_matrix_marks_missing_driver_as_infinite() -> None:
    driver_a = make_driver("a", 100)
    driver_b = make_driver("b", 200)

    matrix = DispatcherService._cost_matrix([[driver_a], [driver_b]], [driver_a, driver_b])

    assert matrix == [[100, inf], [inf, 200]]


def test_assignment_picks_lowest_cost_pairs() -> None:
    matrix = [[10, 100], [80, 20]]

    assignments = DispatcherService._solve_assignment(matrix)

    assert set(assignments) == {(0, 0), (1, 1)}

