from decimal import Decimal

import pytest
from errors import ValidationError


@pytest.fixture(scope="module")
def budgets_function(load_service_function):
    return load_service_function("budgets-service")


class TestValidateCurrency:
    def test_defaults_to_usd_when_no_value_is_given(self, budgets_function):
        assert budgets_function._validate_currency(None) == "USD"

    def test_uppercases_and_trims_a_valid_code(self, budgets_function):
        assert budgets_function._validate_currency(" eur ") == "EUR"

    def test_rejects_a_code_that_is_not_exactly_three_letters(self, budgets_function):
        with pytest.raises(ValidationError):
            budgets_function._validate_currency("DOLLARS")
        with pytest.raises(ValidationError):
            budgets_function._validate_currency("US")

    def test_rejects_a_code_containing_digits_or_symbols(self, budgets_function):
        with pytest.raises(ValidationError):
            budgets_function._validate_currency("US1")


class TestWithBudgetMath:
    def test_computes_remaining_amount_and_percent_used(self, budgets_function):
        row = {"planned_amount": Decimal("1000"), "spent_amount": Decimal("250")}
        result = budgets_function._with_budget_math(row)
        assert result["remaining_amount"] == Decimal("750")
        assert result["percent_used"] == 25.0

    def test_percent_used_is_none_for_a_zero_planned_amount(self, budgets_function):
        # A naive (spent / planned) would raise ZeroDivisionError for an unplanned budget.
        row = {"planned_amount": Decimal("0"), "spent_amount": Decimal("0")}
        result = budgets_function._with_budget_math(row)
        assert result["percent_used"] is None

    def test_treats_a_missing_spent_amount_as_zero(self, budgets_function):
        row = {"planned_amount": Decimal("500")}
        result = budgets_function._with_budget_math(row)
        assert result["remaining_amount"] == Decimal("500")
        assert result["percent_used"] == 0.0

    def test_remaining_amount_can_go_negative_when_overspent(self, budgets_function):
        row = {"planned_amount": Decimal("100"), "spent_amount": Decimal("150")}
        result = budgets_function._with_budget_math(row)
        assert result["remaining_amount"] == Decimal("-50")
        assert result["percent_used"] == 150.0
