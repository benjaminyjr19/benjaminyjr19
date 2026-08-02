"""Tests for strict raw data loading and profiling."""

from __future__ import annotations

import pandas as pd
import pytest

from portfolio_profitability import data_loading
from portfolio_profitability.config import EXPECTED_RAW_SHAPES, RAW_FILES


def test_resolve_raw_paths_covers_every_declared_file(tmp_path):
    paths = data_loading.resolve_raw_paths(tmp_path)
    assert set(paths) == set(RAW_FILES)
    assert all(path.parent == tmp_path for path in paths.values())


def test_missing_files_are_reported_by_name(tmp_path):
    missing = data_loading.missing_raw_files(tmp_path)
    assert {path.name for path in missing} == set(RAW_FILES.values())
    assert data_loading.raw_data_available(tmp_path) is False


def test_load_raises_with_an_actionable_message(tmp_path):
    with pytest.raises(data_loading.RawDataNotFoundError) as error:
        data_loading.load_raw_tables(tmp_path)
    message = str(error.value)
    assert "orders_set_14.csv" in message
    assert "docs/DATA.md" in message


def test_load_returns_every_table(raw_dir):
    tables = data_loading.load_raw_tables(raw_dir)
    assert set(tables) == set(RAW_FILES)
    assert all(isinstance(frame, pd.DataFrame) for frame in tables.values())
    assert data_loading.raw_data_available(raw_dir) is True


def test_provenance_warns_when_input_is_not_the_recorded_dataset(raw_tables):
    report = data_loading.provenance_report(raw_tables)
    # The synthetic fixture is deliberately a different size from the real
    # dataset, so the loader must say so rather than stay silent.
    assert "WARNING" in report
    assert "NOT comparable" in report


def test_provenance_confirms_a_matching_input():
    matching = {
        name: pd.DataFrame(
            0, index=range(rows), columns=[f"c{i}" for i in range(columns)]
        )
        for name, (rows, columns) in EXPECTED_RAW_SHAPES.items()
    }
    report = data_loading.provenance_report(matching)
    assert "WARNING" not in report
    assert "match the dataset used for the published results" in report


def test_missing_value_report_lists_only_columns_with_nulls(raw_tables):
    report = data_loading.missing_value_report(raw_tables)
    assert list(report.columns) == ["table", "column", "missing", "missing_pct"]
    assert (report["missing"] > 0).all()
    reported = set(zip(report["table"], report["column"]))
    assert ("products", "cost") in reported
    assert ("order_items", "order_no") in reported


def test_duplicate_row_report_covers_every_table(raw_tables):
    report = data_loading.duplicate_row_report(raw_tables)
    assert set(report["table"]) == set(raw_tables)
    assert (report["duplicate_rows"] >= 0).all()


def test_referential_integrity_counts_unmatched_rows(raw_tables):
    result = data_loading.referential_integrity(
        raw_tables["order_items"], raw_tables["orders"]
    )
    assert result["rows"] == len(raw_tables["order_items"])
    assert result["matched"] + result["unmatched"] == result["rows"]
    # The fixture nulls a small number of order keys, which cannot match.
    assert result["unmatched"] > 0
