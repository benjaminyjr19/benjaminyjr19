"""Shared pytest fixtures.

All fixtures are built from ``tests.synthetic_data``, which fabricates data for
the sole purpose of exercising code paths. No assertion in this suite checks a
published business result, because the real source files are not distributed
with the repository. The suite verifies that the implementation is correct,
deterministic, and internally consistent.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = REPO_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))
if str(Path(__file__).resolve().parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent))

import synthetic_data  # noqa: E402  (path setup must run first)

from portfolio_profitability import cleaning, features  # noqa: E402


@pytest.fixture(scope="session")
def repo_root() -> Path:
    return REPO_ROOT


@pytest.fixture(scope="session")
def raw_tables() -> dict:
    return synthetic_data.make_all_tables()


@pytest.fixture(scope="session")
def raw_dir(tmp_path_factory) -> Path:
    target = tmp_path_factory.mktemp("synthetic_raw")
    synthetic_data.write_all_tables(target)
    return target


@pytest.fixture(scope="session")
def delivered(raw_tables) -> "object":
    order_items, _ = cleaning.drop_unattributable_order_items(raw_tables["order_items"])
    products, _ = cleaning.impute_missing_cost(raw_tables["products"])
    orders = cleaning.parse_order_dates(raw_tables["orders"])
    facts = cleaning.add_financial_measures(
        cleaning.build_order_item_facts(order_items, products, orders)
    )
    return cleaning.select_delivered(facts)


@pytest.fixture(scope="session")
def product_level(delivered):
    return features.build_product_level(delivered)


@pytest.fixture(scope="session")
def design(product_level):
    return features.build_design_matrix(product_level)
