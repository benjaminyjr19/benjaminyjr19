"""Data preparation: cleansing, date parsing, joining, and financial measures.

Each function returns a new data frame and, where a cleansing decision changes
the row count or imputes values, an accompanying report object so the notebook
and the command line pipeline can state exactly what was changed.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from .config import (
    CANCELLED_STATUS,
    DATE_IS_DAY_FIRST,
    DELIVERED_STATUS,
    ORDER_DATE_COLUMNS,
)


@dataclass(frozen=True)
class DropReport:
    """Summary of rows removed by a cleansing step."""

    rows_before: int
    rows_after: int

    @property
    def removed(self) -> int:
        return self.rows_before - self.rows_after

    @property
    def removed_pct(self) -> float:
        return self.removed / self.rows_before * 100 if self.rows_before else 0.0


@dataclass(frozen=True)
class ImputationReport:
    """Summary of an imputation step, before and after the change."""

    imputed: int
    total: int
    mean_before: float
    mean_after: float
    median_before: float
    median_after: float
    fell_back_to_global_median: int

    @property
    def imputed_pct(self) -> float:
        return self.imputed / self.total * 100 if self.total else 0.0


def drop_unattributable_order_items(
    order_items: pd.DataFrame, key: str = "order_no"
) -> tuple[pd.DataFrame, DropReport]:
    """Remove order item rows that carry no parent order key.

    Rows without an order key cannot be attributed to a customer, an order
    status, or a purchase date, so they cannot enter a revenue calculation.
    They are removed rather than imputed because there is no defensible basis
    for inventing an order identifier.
    """
    before = len(order_items)
    cleaned = order_items.dropna(subset=[key]).copy()
    return cleaned, DropReport(rows_before=before, rows_after=len(cleaned))


def impute_missing_cost(
    products: pd.DataFrame,
    cost_column: str = "cost",
    category_column: str = "product_category_name",
    output_column: str = "cost_clean",
) -> tuple[pd.DataFrame, ImputationReport]:
    """Fill missing product cost with the median cost of the same category.

    Cost is the denominator of every margin measure, so dropping products
    without a cost would silently remove them from the profitability analysis
    and bias the category totals. The median is used in preference to the mean
    because cost is strongly right skewed.

    If an entire category has no recorded cost, the category median is itself
    undefined. Those rows fall back to the global median so that the step can
    never leave a null behind. The number of such rows is reported.
    """
    result = products.copy()
    missing_before = int(result[cost_column].isna().sum())

    category_median = result.groupby(category_column)[cost_column].transform("median")
    filled = result[cost_column].fillna(category_median)

    still_missing = int(filled.isna().sum())
    if still_missing:
        filled = filled.fillna(result[cost_column].median())

    result[output_column] = filled

    report = ImputationReport(
        imputed=missing_before,
        total=len(result),
        mean_before=float(result[cost_column].mean()),
        mean_after=float(result[output_column].mean()),
        median_before=float(result[cost_column].median()),
        median_after=float(result[output_column].median()),
        fell_back_to_global_median=still_missing,
    )
    return result, report


def category_median_cost(
    products: pd.DataFrame,
    cost_column: str = "cost",
    category_column: str = "product_category_name",
) -> pd.Series:
    """Return the median cost of each product category before imputation."""
    return products.groupby(category_column)[cost_column].median()


def parse_order_dates(
    orders: pd.DataFrame, date_columns: list[str] | None = None
) -> pd.DataFrame:
    """Parse the order timestamp columns using day first ordering."""
    result = orders.copy()
    for column in date_columns or ORDER_DATE_COLUMNS:
        if column in result.columns:
            result[column] = pd.to_datetime(
                result[column], dayfirst=DATE_IS_DAY_FIRST, errors="coerce"
            )
    return result


def build_order_item_facts(
    order_items: pd.DataFrame, products: pd.DataFrame, orders: pd.DataFrame
) -> pd.DataFrame:
    """Join the cleaned tables into a single order item level fact table.

    Inner joins are used on both sides. An order item that resolves to neither
    a product nor an order cannot be costed, so retaining it would introduce
    rows with undefined margin.
    """
    order_columns = [
        column
        for column in [
            "order_id",
            "order_status",
            "customer_no",
            "order_purchase_timestamp",
        ]
        if column in orders.columns
    ]
    return (
        order_items.merge(
            products, left_on="product_no", right_on="product_id", how="inner"
        )
        .merge(
            orders[order_columns],
            left_on="order_no",
            right_on="order_id",
            how="inner",
        )
        .reset_index(drop=True)
    )


def add_financial_measures(facts: pd.DataFrame) -> pd.DataFrame:
    """Derive net revenue, gross profit, contribution profit, and volume.

    Net revenue         = price x (1 - discount_rate)
    Gross profit        = net revenue - cost of goods sold
    Contribution profit = gross profit - freight value
    """
    result = facts.copy()
    result["net_revenue"] = result["price"] * (1 - result["discount_rate"])
    result["cogs"] = result["cost_clean"]
    result["gross_profit"] = result["net_revenue"] - result["cogs"]
    result["contribution_profit"] = result["gross_profit"] - result["freight_value"]
    result["volume_cm3"] = (
        result["product_length_cm"]
        * result["product_height_cm"]
        * result["product_width_cm"]
    )
    return result


def select_delivered(facts: pd.DataFrame) -> pd.DataFrame:
    """Return only the delivered order items.

    Cancelled orders never generate recognised revenue, so including them
    would overstate every category total.
    """
    return facts[facts["order_status"] == DELIVERED_STATUS].copy()


def select_cancelled(facts: pd.DataFrame) -> pd.DataFrame:
    """Return only the cancelled order items."""
    return facts[facts["order_status"] == CANCELLED_STATUS].copy()


def portfolio_totals(delivered: pd.DataFrame) -> dict[str, float]:
    """Aggregate the delivered fact table into the headline financial totals."""
    revenue = float(delivered["net_revenue"].sum())
    cogs = float(delivered["cogs"].sum())
    gross_profit = float(delivered["gross_profit"].sum())
    freight = float(delivered["freight_value"].sum())
    contribution = float(delivered["contribution_profit"].sum())

    def share(value: float) -> float:
        return value / revenue * 100 if revenue else 0.0

    return {
        "order_items": len(delivered),
        "net_revenue": revenue,
        "cogs": cogs,
        "gross_profit": gross_profit,
        "gross_margin_pct": share(gross_profit),
        "freight": freight,
        "freight_pct_of_revenue": share(freight),
        "contribution_profit": contribution,
        "contribution_margin_pct": share(contribution),
    }
