"""Tests for the cleansing, joining, and financial measure logic."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from portfolio_profitability import cleaning


def test_dropping_unattributable_rows_removes_exactly_the_nulls():
    frame = pd.DataFrame({"order_no": ["a", None, "b", None], "value": [1, 2, 3, 4]})
    cleaned, report = cleaning.drop_unattributable_order_items(frame)

    assert len(cleaned) == 2
    assert cleaned["order_no"].isna().sum() == 0
    assert report.rows_before == 4
    assert report.rows_after == 2
    assert report.removed == 2
    assert report.removed_pct == pytest.approx(50.0)


def test_dropping_does_not_mutate_the_input():
    frame = pd.DataFrame({"order_no": ["a", None], "value": [1, 2]})
    cleaning.drop_unattributable_order_items(frame)
    assert len(frame) == 2


def test_cost_imputation_uses_the_category_median():
    products = pd.DataFrame(
        {
            "product_category_name": ["books", "books", "books", "auto", "auto"],
            "cost": [10.0, 20.0, np.nan, 100.0, np.nan],
        }
    )
    result, report = cleaning.impute_missing_cost(products)

    # Median of [10, 20] is 15. Median of [100] is 100.
    assert result.loc[2, "cost_clean"] == pytest.approx(15.0)
    assert result.loc[4, "cost_clean"] == pytest.approx(100.0)
    assert result["cost_clean"].isna().sum() == 0
    assert report.imputed == 2
    assert report.fell_back_to_global_median == 0


def test_cost_imputation_falls_back_when_a_whole_category_is_missing():
    products = pd.DataFrame(
        {
            "product_category_name": ["books", "books", "toys"],
            "cost": [10.0, 30.0, np.nan],
        }
    )
    result, report = cleaning.impute_missing_cost(products)

    # The toys category has no cost at all, so the global median of [10, 30]
    # is used instead of leaving a null behind.
    assert result["cost_clean"].isna().sum() == 0
    assert result.loc[2, "cost_clean"] == pytest.approx(20.0)
    assert report.fell_back_to_global_median == 1


def test_original_cost_column_is_preserved(raw_tables):
    result, _ = cleaning.impute_missing_cost(raw_tables["products"])
    assert result["cost"].isna().sum() > 0
    assert result["cost_clean"].isna().sum() == 0


def test_dates_are_parsed_day_first():
    orders = pd.DataFrame({"order_purchase_timestamp": ["03/04/2020", "25/12/2021"]})
    result = cleaning.parse_order_dates(orders, ["order_purchase_timestamp"])

    first = result["order_purchase_timestamp"].iloc[0]
    assert (first.day, first.month, first.year) == (3, 4, 2020)
    second = result["order_purchase_timestamp"].iloc[1]
    assert (second.day, second.month, second.year) == (25, 12, 2021)


def test_date_parsing_skips_absent_columns():
    orders = pd.DataFrame({"order_purchase_timestamp": ["01/02/2020"]})
    result = cleaning.parse_order_dates(orders)
    assert pd.api.types.is_datetime64_any_dtype(result["order_purchase_timestamp"])


def test_fact_table_keeps_only_rows_that_join_on_both_sides(raw_tables):
    order_items, _ = cleaning.drop_unattributable_order_items(raw_tables["order_items"])
    products, _ = cleaning.impute_missing_cost(raw_tables["products"])
    orders = cleaning.parse_order_dates(raw_tables["orders"])
    facts = cleaning.build_order_item_facts(order_items, products, orders)

    assert len(facts) <= len(order_items)
    assert facts["product_no"].isin(products["product_id"]).all()
    assert facts["order_no"].isin(orders["order_id"]).all()


def test_financial_measures_follow_their_definitions(delivered):
    expected_revenue = delivered["price"] * (1 - delivered["discount_rate"])
    assert np.allclose(delivered["net_revenue"], expected_revenue)
    assert np.allclose(
        delivered["gross_profit"], delivered["net_revenue"] - delivered["cogs"]
    )
    assert np.allclose(
        delivered["contribution_profit"],
        delivered["gross_profit"] - delivered["freight_value"],
    )
    assert np.allclose(
        delivered["volume_cm3"],
        delivered["product_length_cm"]
        * delivered["product_height_cm"]
        * delivered["product_width_cm"],
    )


def test_cogs_uses_the_imputed_cost_and_never_the_raw_column(delivered):
    assert delivered["cogs"].isna().sum() == 0
    assert np.allclose(delivered["cogs"], delivered["cost_clean"])


def test_delivered_and_cancelled_partition_the_fact_table(raw_tables):
    order_items, _ = cleaning.drop_unattributable_order_items(raw_tables["order_items"])
    products, _ = cleaning.impute_missing_cost(raw_tables["products"])
    orders = cleaning.parse_order_dates(raw_tables["orders"])
    facts = cleaning.add_financial_measures(
        cleaning.build_order_item_facts(order_items, products, orders)
    )

    delivered_rows = cleaning.select_delivered(facts)
    cancelled_rows = cleaning.select_cancelled(facts)

    assert len(delivered_rows) + len(cancelled_rows) == len(facts)
    assert set(delivered_rows["order_status"]) == {"delivered"}
    assert set(cancelled_rows["order_status"]) == {"canceled"}


def test_portfolio_totals_reconcile(delivered):
    totals = cleaning.portfolio_totals(delivered)

    assert totals["order_items"] == len(delivered)
    assert totals["gross_profit"] == pytest.approx(
        totals["net_revenue"] - totals["cogs"]
    )
    assert totals["contribution_profit"] == pytest.approx(
        totals["gross_profit"] - totals["freight"]
    )
    assert totals["gross_margin_pct"] == pytest.approx(
        totals["gross_profit"] / totals["net_revenue"] * 100
    )


def test_portfolio_totals_handle_an_empty_frame():
    empty = pd.DataFrame(
        {
            "net_revenue": [],
            "cogs": [],
            "gross_profit": [],
            "freight_value": [],
            "contribution_profit": [],
        }
    )
    totals = cleaning.portfolio_totals(empty)
    assert totals["order_items"] == 0
    assert totals["gross_margin_pct"] == 0.0
