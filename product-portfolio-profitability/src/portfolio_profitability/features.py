"""Aggregation to the product level and construction of the design matrix.

The decision maker invests in products rather than in individual transactions,
so the unit of analysis is one product and the target is the total contribution
profit that product has generated across every delivered order.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from .config import (
    CATEGORICAL_FEATURES,
    DUMMY_PREFIX,
    NUMERIC_FEATURES,
    TARGET,
    WEIGHT_BAND_EDGES,
    WEIGHT_BAND_LABELS,
)

PRODUCT_KEY = "product_no"


def count_products_with_varying_price(
    delivered: pd.DataFrame, price_column: str = "price"
) -> int:
    """Count products that appear at more than one price in the delivered data.

    ``build_product_level`` takes the first observed price and cost for each
    product. That is exact only when a product carries a single price. This
    check surfaces any violation instead of letting it bias the features
    silently.
    """
    per_product = delivered.groupby(PRODUCT_KEY)[price_column].nunique()
    return int((per_product > 1).sum())


def build_product_level(delivered: pd.DataFrame) -> pd.DataFrame:
    """Aggregate the delivered fact table to one row per product."""
    product_level = (
        delivered.groupby(PRODUCT_KEY)
        .agg(
            units_sold=("net_revenue", "size"),
            revenue=("net_revenue", "sum"),
            gross_profit=("gross_profit", "sum"),
            contribution_profit=("contribution_profit", "sum"),
            unit_price=("price", "first"),
            unit_cost=("cogs", "first"),
            weight_g=("product_weight_g", "first"),
            length_cm=("product_length_cm", "first"),
            height_cm=("product_height_cm", "first"),
            width_cm=("product_width_cm", "first"),
            avg_discount_rate=("discount_rate", "mean"),
            category=("product_category_name", "first"),
        )
        .reset_index()
    )

    product_level["volume_cm3"] = (
        product_level["length_cm"]
        * product_level["height_cm"]
        * product_level["width_cm"]
    )
    product_level["unit_gross_margin"] = (
        product_level["unit_price"] - product_level["unit_cost"]
    )
    return product_level


def build_design_matrix(
    product_level: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.Series]:
    """Return the one hot encoded design matrix and the target vector.

    The first category in sorted order is dropped and becomes the baseline that
    every category coefficient is measured against.
    """
    features = pd.get_dummies(
        product_level[NUMERIC_FEATURES + CATEGORICAL_FEATURES],
        columns=CATEGORICAL_FEATURES,
        drop_first=True,
        prefix=DUMMY_PREFIX,
    ).astype(float)
    target = product_level[TARGET]
    return features, target


def baseline_category(product_level: pd.DataFrame) -> str:
    """Return the category that ``build_design_matrix`` drops as the baseline."""
    return str(sorted(product_level["category"].dropna().unique())[0])


def category_summary(delivered: pd.DataFrame) -> pd.DataFrame:
    """Summarise revenue, profit, and margin by product category."""
    revenue_total = delivered["net_revenue"].sum()
    gross_profit_total = delivered["gross_profit"].sum()

    summary = (
        delivered.groupby("product_category_name")
        .agg(
            units=("net_revenue", "size"),
            revenue=("net_revenue", "sum"),
            gross_profit=("gross_profit", "sum"),
            freight=("freight_value", "sum"),
            contribution_profit=("contribution_profit", "sum"),
            avg_unit_price=("price", "mean"),
            avg_freight=("freight_value", "mean"),
        )
        .reset_index()
    )

    summary["gross_margin_pct"] = summary["gross_profit"] / summary["revenue"] * 100
    summary["contribution_margin_pct"] = (
        summary["contribution_profit"] / summary["revenue"] * 100
    )
    summary["revenue_share_pct"] = summary["revenue"] / revenue_total * 100
    summary["gross_profit_share_pct"] = (
        summary["gross_profit"] / gross_profit_total * 100
    )
    summary["gross_profit_per_unit"] = summary["gross_profit"] / summary["units"]

    return summary.sort_values("revenue", ascending=False).reset_index(drop=True)


def freight_correlations(delivered: pd.DataFrame) -> pd.Series:
    """Correlate freight value with the physical and price attributes."""
    return pd.Series(
        {
            "product_weight_g": delivered["freight_value"].corr(
                delivered["product_weight_g"]
            ),
            "volume_cm3": delivered["freight_value"].corr(delivered["volume_cm3"]),
            "price": delivered["freight_value"].corr(delivered["price"]),
        }
    )


def freight_by_weight_band(delivered: pd.DataFrame) -> pd.DataFrame:
    """Average freight charge within each product weight band.

    The outer band edges are unbounded so that no row can fall outside the
    banding and be dropped without notice. The interior edges match the bands
    used in the source notebook, so the table is directly comparable.
    """
    edges = [-np.inf, *WEIGHT_BAND_EDGES[1:], np.inf]
    bands = pd.cut(
        delivered["product_weight_g"], bins=edges, labels=WEIGHT_BAND_LABELS
    )

    banded = delivered.assign(weight_band=bands)
    if banded["weight_band"].isna().any():
        raise ValueError(
            "Weight banding produced null bands, which means rows would be "
            "dropped from the freight evidence table."
        )

    result = (
        banded.groupby("weight_band", observed=False)
        .agg(units=("freight_value", "size"), avg_freight=("freight_value", "mean"))
        .reset_index()
    )
    if int(result["units"].sum()) != len(delivered):
        raise ValueError("Weight band unit counts do not reconcile to the input rows.")
    return result


def units_per_product_by_category(product_level: pd.DataFrame) -> pd.DataFrame:
    """Products, total units, and mean units per product in each category.

    This supports or refutes any claim that a category effect is driven by
    sales volume rather than by margin.
    """
    return (
        product_level.groupby("category")
        .agg(
            products=("units_sold", "size"),
            total_units=("units_sold", "sum"),
            mean_units_per_product=("units_sold", "mean"),
            median_units_per_product=("units_sold", "median"),
        )
        .reset_index()
        .sort_values("mean_units_per_product", ascending=False, ignore_index=True)
    )
