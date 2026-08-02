"""SYNTHETIC TEST FIXTURE. NOT THE STUDY DATA. NOT A SOURCE OF RESULTS.

This module fabricates small, deterministic tables whose only purpose is to
exercise the code paths in ``portfolio_profitability`` so the package can be
tested without the real source files, which are not distributed with this
repository.

Read this before using anything here:

1. Nothing produced by this module is real. The values are drawn from a seeded
   pseudo random generator and carry no business meaning whatsoever.
2. No number reported in README.md, docs/RESULTS.md, or anywhere else in this
   repository was computed from this fixture. Every published figure comes from
   the recorded execution of the source notebook against the real files.
3. Running the pipeline against this fixture will print a loud provenance
   warning, because the table shapes deliberately do not match the recorded
   dataset. That warning is the intended behaviour, not a defect.

Column naming
-------------
``orders`` uses the real column names, all eight of which the analysis
references. ``order_items`` and ``products`` contain additional columns in the
real files whose names are not documented in the source notebook and could not
be verified. Those are named ``column_a``, ``column_b``, and so on here to make
it unmistakable that they are placeholders and not a claim about the real
schema. ``customers`` and ``sellers`` are only profiled for data quality and
none of their columns are referenced, so they are entirely placeholders.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from portfolio_profitability.config import RAW_FILES

CATEGORIES = [
    "auto",
    "books",
    "electronics",
    "fashion",
    "furniture",
    "home_goods",
    "toys",
]

FIXTURE_SEED = 20240101


def make_products(n_products: int = 90, seed: int = FIXTURE_SEED) -> pd.DataFrame:
    """Synthetic product master with a realistic share of missing costs."""
    rng = np.random.default_rng(seed)
    product_ids = [f"p{index:05d}" for index in range(n_products)]
    categories = [CATEGORIES[index % len(CATEGORIES)] for index in range(n_products)]

    cost = np.round(rng.gamma(shape=2.0, scale=60.0, size=n_products) + 5.0, 2)
    # Blank out roughly five percent of costs so the imputation path is tested.
    missing_positions = rng.choice(n_products, size=max(1, n_products // 20), replace=False)
    cost = cost.astype(object)
    for position in missing_positions:
        cost[position] = np.nan

    return pd.DataFrame(
        {
            "product_id": product_ids,
            "product_category_name": categories,
            "cost": pd.to_numeric(pd.Series(cost)),
            "product_weight_g": rng.integers(50, 30_000, size=n_products),
            "product_length_cm": rng.integers(5, 120, size=n_products),
            "product_height_cm": rng.integers(2, 60, size=n_products),
            "product_width_cm": rng.integers(2, 60, size=n_products),
            "column_a": rng.integers(0, 5, size=n_products),
            "column_b": rng.integers(0, 5, size=n_products),
            "column_c": rng.integers(0, 5, size=n_products),
        }
    )


def make_orders(n_orders: int = 400, seed: int = FIXTURE_SEED + 1) -> pd.DataFrame:
    """Synthetic order header table with day first timestamps."""
    rng = np.random.default_rng(seed)
    order_ids = [f"o{index:05d}" for index in range(n_orders)]
    status = np.where(rng.random(n_orders) < 0.07, "canceled", "delivered")

    # Day first strings, deliberately including days above twelve so that a
    # month first parse would fail loudly rather than silently transpose.
    days = rng.integers(13, 29, size=n_orders)
    months = rng.integers(1, 13, size=n_orders)
    years = rng.integers(2019, 2026, size=n_orders)
    purchase = [f"{d}/{m}/{y}" for d, m, y in zip(days, months, years)]

    frame = pd.DataFrame(
        {
            "order_id": order_ids,
            "order_status": status,
            "customer_no": [f"c{index:05d}" for index in range(n_orders)],
            "order_purchase_timestamp": purchase,
            "order_approved_at": purchase,
            "order_delivered_carrier_date": purchase,
            "order_delivered_customer_date": purchase,
            "order_estimated_delivery_date": purchase,
        }
    )
    # Leave delivery dates blank on cancelled orders so the missing value
    # profile has something to report.
    cancelled = frame["order_status"] == "canceled"
    frame.loc[cancelled, "order_delivered_carrier_date"] = np.nan
    frame.loc[cancelled, "order_delivered_customer_date"] = np.nan
    return frame


def make_order_items(
    products: pd.DataFrame,
    orders: pd.DataFrame,
    items_per_order: int = 2,
    seed: int = FIXTURE_SEED + 2,
) -> pd.DataFrame:
    """Synthetic order line table.

    One price per product is used throughout, which mirrors the structure the
    product level aggregation assumes. A small number of rows are given a null
    order key so the unattributable row removal path is tested.
    """
    rng = np.random.default_rng(seed)
    price_by_product = dict(
        zip(
            products["product_id"],
            np.round(rng.gamma(shape=3.0, scale=70.0, size=len(products)) + 10.0, 2),
        )
    )

    rows = []
    for order_id in orders["order_id"]:
        for _ in range(items_per_order):
            product_id = str(rng.choice(products["product_id"].to_numpy()))
            rows.append(
                {
                    "order_no": order_id,
                    "product_no": product_id,
                    "price": price_by_product[product_id],
                    "freight_value": round(float(rng.normal(108.0, 4.0)), 2),
                    "discount_rate": round(float(rng.choice([0.0, 0.0, 0.05, 0.1])), 4),
                    "column_a": 1,
                    "column_b": 1,
                }
            )

    frame = pd.DataFrame(rows)
    orphan_positions = rng.choice(len(frame), size=max(1, len(frame) // 100), replace=False)
    frame.loc[orphan_positions, "order_no"] = np.nan
    return frame


def make_placeholder_table(n_rows: int, n_columns: int, seed: int) -> pd.DataFrame:
    """Table whose columns are never referenced by the analysis."""
    rng = np.random.default_rng(seed)
    return pd.DataFrame(
        {
            f"column_{index + 1}": rng.integers(0, 100, size=n_rows)
            for index in range(n_columns)
        }
    )


def make_all_tables(seed: int = FIXTURE_SEED) -> dict[str, pd.DataFrame]:
    """Build the complete synthetic table set."""
    products = make_products(seed=seed)
    orders = make_orders(seed=seed + 1)
    order_items = make_order_items(products, orders, seed=seed + 2)
    return {
        "customers": make_placeholder_table(len(orders), 9, seed + 3),
        "order_items": order_items,
        "orders": orders,
        "products": products,
        "sellers": make_placeholder_table(40, 8, seed + 4),
    }


def write_all_tables(target_dir: Path, seed: int = FIXTURE_SEED) -> dict[str, Path]:
    """Write the synthetic tables under the raw file names used by the loader."""
    target_dir = Path(target_dir)
    target_dir.mkdir(parents=True, exist_ok=True)
    tables = make_all_tables(seed=seed)
    paths = {}
    for name, filename in RAW_FILES.items():
        path = target_dir / filename
        tables[name].to_csv(path, index=False)
        paths[name] = path
    return paths


if __name__ == "__main__":  # pragma: no cover - manual smoke test helper
    import argparse

    parser = argparse.ArgumentParser(
        description=(
            "Write the SYNTHETIC test fixture to a directory. This is not the "
            "study data and must never be used to produce reported results."
        )
    )
    parser.add_argument("target", type=Path, help="Directory to write the CSV files to")
    written = write_all_tables(parser.parse_args().target)
    for table_name, file_path in written.items():
        print(f"{table_name:12s} {file_path}")
