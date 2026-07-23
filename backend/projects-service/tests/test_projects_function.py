import pytest


@pytest.fixture(scope="module")
def projects_function(load_service_function):
    return load_service_function("projects-service")


class TestWithCompletion:
    def test_computes_the_rounded_completion_percent(self, projects_function):
        row = {"deliverable_count": 3, "completed_count": 1}
        result = projects_function._with_completion(row)
        assert result["completion_percent"] == 33  # round(1/3 * 100) == 33

    def test_is_zero_percent_when_nothing_is_completed(self, projects_function):
        row = {"deliverable_count": 5, "completed_count": 0}
        assert projects_function._with_completion(row)["completion_percent"] == 0

    def test_is_a_hundred_percent_when_everything_is_completed(self, projects_function):
        row = {"deliverable_count": 4, "completed_count": 4}
        assert projects_function._with_completion(row)["completion_percent"] == 100

    def test_is_zero_percent_for_a_project_with_no_deliverables_at_all(self, projects_function):
        # Guards the ZeroDivisionError that a naive (completed / total) would hit.
        row = {"deliverable_count": 0, "completed_count": 0}
        assert projects_function._with_completion(row)["completion_percent"] == 0

    def test_treats_missing_counts_as_zero(self, projects_function):
        # LEFT JOINs on a project with zero deliverables return NULL counts, not 0.
        assert projects_function._with_completion({})["completion_percent"] == 0

    def test_mutates_and_returns_the_same_row(self, projects_function):
        row = {"deliverable_count": 2, "completed_count": 1}
        result = projects_function._with_completion(row)
        assert result is row
