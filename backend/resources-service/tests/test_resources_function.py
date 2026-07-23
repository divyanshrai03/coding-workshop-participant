import pytest


@pytest.fixture(scope="module")
def resources_function(load_service_function):
    return load_service_function("resources-service")


class TestWithWorkload:
    def test_flags_over_100_percent_allocation_as_overallocated(self, resources_function):
        row = {"total_allocation_percent": 120, "capacity_hours_per_week": 40}
        assert resources_function._with_workload(row)["is_overallocated"] is True

    def test_exactly_100_percent_is_not_overallocated(self, resources_function):
        row = {"total_allocation_percent": 100, "capacity_hours_per_week": 40}
        assert resources_function._with_workload(row)["is_overallocated"] is False

    def test_treats_a_missing_allocation_as_zero_not_overallocated(self, resources_function):
        row = {"capacity_hours_per_week": 40}
        result = resources_function._with_workload(row)
        assert result["is_overallocated"] is False
        assert result["allocated_hours_per_week"] == 0

    def test_computes_allocated_hours_from_capacity_and_allocation(self, resources_function):
        row = {"total_allocation_percent": 50, "capacity_hours_per_week": 40}
        assert resources_function._with_workload(row)["allocated_hours_per_week"] == 20.0

    def test_rounds_allocated_hours_to_two_decimal_places(self, resources_function):
        row = {"total_allocation_percent": 33, "capacity_hours_per_week": 40}
        assert resources_function._with_workload(row)["allocated_hours_per_week"] == 13.2

    def test_allocated_hours_is_none_when_capacity_is_unset(self, resources_function):
        # Distinguishes "no data" (None) from "genuinely zero hours" (0.0).
        row = {"total_allocation_percent": 50, "capacity_hours_per_week": None}
        assert resources_function._with_workload(row)["allocated_hours_per_week"] is None
