"""Tests for product level aggregation and design matrix construction."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from portfolio_profitability import features
from portfolio_profitability.config import DUMMY_PREFIX, NUMERIC_FEATURES, TARGET


def test_product_level_has_one_row_per_delivered_product(delivered, product_level):
    assert len(product_level) == delivered["product_no"].nunique()
    assert product_level["product_no"].is_unique


def test_product_level_sums_reconcile_to_the_fact_table(delivered, product_level):
    assert product_level["units_sold"].sum() == len(delivered)
    assert product_level["revenue"].sum() == pytest.approx(
        delivered["net_revenue"].sum()
    )
    assert product_level["contribution_profit"].sum() == pytest.approx(
        delivered["contribution_profit"].sum()
    )


def test_derived_product_columns_are_correct(product_level):
    assert np.allclose(
        product_level["volume_cm3"],
        product_level["length_cm"]
        * product_level["height_cm"]
        * product_level["width_cm"],
    )
    assert np.allclose(
        product_level["unit_gross_margin"],
        product_level["unit_price"] - product_level["unit_cost"],
    )


def test_varying_price_check_detects_a_violation():
    frame = pd.DataFrame(
        {"product_no": ["a", "a", "b", "b"], "price": [10.0, 12.0, 5.0, 5.0]}
    )
    assert features.count_products_with_varying_price(frame) == 1


def test_varying_price_check_passes_on_a_single_price_fixture(delivered):
    # The fixture assigns one price per product, so taking the first observed
    # price is exact.
    assert features.count_products_with_varying_price(delivered) == 0


def test_design_matrix_shape_and_dtypes(product_level, design):
    matrix, target = design
    n_categories = product_level["category"].nunique()

    assert len(matrix) == len(product_level)
    assert matrix.shape[1] == len(NUMERIC_FEATURES) + n_categories - 1
    assert (matrix.dtypes == float).all()
    assert target.name == TARGET
    assert matrix.index.equals(product_level.index)


def test_design_matrix_drops_the_baseline_category(product_level, design):
    matrix, _ = design
    baseline = features.baseline_category(product_level)
    dummy_columns = [c for c in matrix.columns if c.startswith(f"{DUMMY_PREFIX}_")]

    assert f"{DUMMY_PREFIX}_{baseline}" not in dummy_columns
    assert baseline == sorted(product_level["category"].unique())[0]
    # Every row belongs to exactly one category, so a baseline row is all zeros.
    assert set(matrix[dummy_columns].sum(axis=1).unique()) <= {0.0, 1.0}


def test_design_matrix_has_no_missing_values(design):
    matrix, target = design
    assert matrix.isna().sum().sum() == 0
    assert target.isna().sum() == 0


def test_category_summary_reconciles_to_the_delivered_totals(delivered):
    summary = features.category_summary(delivered)

    assert summary["units"].sum() == len(delivered)
    assert summary["revenue"].sum() == pytest.approx(delivered["net_revenue"].sum())
    assert summary["revenue_share_pct"].sum() == pytest.approx(100.0)
    assert summary["gross_profit_share_pct"].sum() == pytest.approx(100.0)
    assert summary["revenue"].is_monotonic_decreasing


def test_category_summary_margins_are_internally_consistent(delivered):
    summary = features.category_summary(delivered)
    assert np.allclose(
        summary["gross_margin_pct"], summary["gross_profit"] / summary["revenue"] * 100
    )
    assert np.allclose(
        summary["gross_profit_per_unit"], summary["gross_profit"] / summary["units"]
    )


def test_freight_correlations_are_within_range(delivered):
    correlations = features.freight_correlations(delivered)
    assert set(correlations.index) == {"product_weight_g", "volume_cm3", "price"}
    assert correlations.between(-1.0, 1.0).all()


def test_weight_bands_never_drop_a_row(delivered):
    banded = features.freight_by_weight_band(delivered)
    assert banded["units"].sum() == len(delivered)
    assert len(banded) == 5


def test_weight_bands_include_values_outside_the_original_edges():
    # The source notebook used a closed range of zero to sixty thousand grams.
    # Anything outside it silently became a null band and was dropped. The
    # outer edges are now unbounded, so extremes are still counted.
    frame = pd.DataFrame(
        {
            "product_weight_g": [0, 250, 800, 3_000, 12_000, 90_000],
            "freight_value": [100.0, 101.0, 102.0, 103.0, 104.0, 105.0],
        }
    )
    banded = features.freight_by_weight_band(frame)
    assert banded["units"].sum() == 6
    assert banded.loc[banded["weight_band"] == "0-500 g", "units"].iloc[0] == 2
    assert banded.loc[banded["weight_band"] == "Above 15,000 g", "units"].iloc[0] == 1


def test_units_per_product_by_category_reconciles(product_level):
    summary = features.units_per_product_by_category(product_level)
    assert summary["products"].sum() == len(product_level)
    assert summary["total_units"].sum() == product_level["units_sold"].sum()
    assert np.allclose(
        summary["mean_units_per_product"], summary["total_units"] / summary["products"]
    )
