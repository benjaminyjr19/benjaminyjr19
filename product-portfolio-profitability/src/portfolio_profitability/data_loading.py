"""Loading and profiling of the five raw source tables.

The loader is deliberately strict. It resolves one documented location, raises
an explicit error naming the missing files when they are absent, and reports
whether the loaded tables match the dataset that produced the published
results. Silent fallbacks are avoided because they make it possible to publish
numbers computed from the wrong input.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

from .config import EXPECTED_RAW_SHAPES, RAW_DATA_DIR, RAW_FILES


class RawDataNotFoundError(FileNotFoundError):
    """Raised when one or more required source CSV files cannot be located."""


@dataclass(frozen=True)
class ShapeCheck:
    """Result of comparing a loaded table against its recorded shape."""

    table: str
    observed: tuple[int, int]
    expected: tuple[int, int] | None

    @property
    def matches(self) -> bool:
        return self.expected is not None and self.observed == self.expected


def resolve_raw_paths(data_dir: Path | None = None) -> dict[str, Path]:
    """Return the expected path of every raw file under ``data_dir``.

    Parameters
    ----------
    data_dir:
        Directory holding the raw CSV files. Defaults to ``data/raw`` inside
        the repository.
    """
    base = Path(data_dir) if data_dir is not None else RAW_DATA_DIR
    return {name: base / filename for name, filename in RAW_FILES.items()}


def missing_raw_files(data_dir: Path | None = None) -> list[Path]:
    """Return the paths of raw files that are not present on disk."""
    return [path for path in resolve_raw_paths(data_dir).values() if not path.is_file()]


def raw_data_available(data_dir: Path | None = None) -> bool:
    """Return True when all five raw source files are present."""
    return not missing_raw_files(data_dir)


def load_raw_tables(data_dir: Path | None = None) -> dict[str, pd.DataFrame]:
    """Load the five raw source tables into a dictionary of data frames.

    Raises
    ------
    RawDataNotFoundError
        If any required file is missing. The message names every missing file
        and the directory that was searched, so the operator can act on it
        without reading the source.
    """
    base = Path(data_dir) if data_dir is not None else RAW_DATA_DIR
    missing = missing_raw_files(base)
    if missing:
        names = ", ".join(sorted(path.name for path in missing))
        raise RawDataNotFoundError(
            f"Missing {len(missing)} of {len(RAW_FILES)} required source files "
            f"in {base}: {names}. See docs/DATA.md for the expected schema and "
            f"the reason the files are not distributed with this repository."
        )
    return {
        name: pd.read_csv(path) for name, path in resolve_raw_paths(base).items()
    }


def check_expected_shapes(tables: dict[str, pd.DataFrame]) -> list[ShapeCheck]:
    """Compare loaded table shapes against the recorded dataset shapes."""
    return [
        ShapeCheck(
            table=name,
            observed=(frame.shape[0], frame.shape[1]),
            expected=EXPECTED_RAW_SHAPES.get(name),
        )
        for name, frame in tables.items()
    ]


def provenance_report(tables: dict[str, pd.DataFrame]) -> str:
    """Return a human readable statement of whether the input is the recorded dataset.

    This exists so that anyone running the pipeline can tell at a glance
    whether the numbers they are about to see are comparable with the published
    results, or were produced from a different or synthetic input.
    """
    checks = check_expected_shapes(tables)
    lines = ["RAW INPUT PROVENANCE CHECK"]
    for check in checks:
        expected = (
            f"{check.expected[0]:,} x {check.expected[1]}"
            if check.expected is not None
            else "not recorded"
        )
        status = "match" if check.matches else "DIFFERENT"
        lines.append(
            f"  {check.table:12s} loaded {check.observed[0]:>6,} x {check.observed[1]:<2}"
            f"  recorded {expected:>12s}  [{status}]"
        )

    if all(check.matches for check in checks):
        lines.append("")
        lines.append(
            "  All five tables match the dataset used for the published results."
        )
    else:
        lines.append("")
        lines.append(
            "  WARNING: the loaded input does not match the recorded dataset. "
            "Any results produced from it are NOT comparable with the figures "
            "reported in README.md and docs/RESULTS.md."
        )
    return "\n".join(lines)


def missing_value_report(tables: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Return one row per column that contains at least one missing value."""
    rows = []
    for name, frame in tables.items():
        nulls = frame.isna().sum()
        for column, count in nulls[nulls > 0].items():
            rows.append(
                {
                    "table": name,
                    "column": column,
                    "missing": int(count),
                    "missing_pct": round(count / len(frame) * 100, 2),
                }
            )
    return pd.DataFrame(
        rows, columns=["table", "column", "missing", "missing_pct"]
    ).sort_values(["table", "column"], ignore_index=True)


def duplicate_row_report(tables: dict[str, pd.DataFrame]) -> pd.DataFrame:
    """Return the count of exact duplicate rows in each table."""
    return pd.DataFrame(
        [
            {"table": name, "duplicate_rows": int(frame.duplicated().sum())}
            for name, frame in tables.items()
        ]
    )


def referential_integrity(
    order_items: pd.DataFrame,
    orders: pd.DataFrame,
    left_key: str = "order_no",
    right_key: str = "order_id",
) -> dict[str, float]:
    """Measure how many order item rows resolve to a parent order."""
    total = len(order_items)
    matched = int(order_items[left_key].isin(orders[right_key]).sum())
    return {
        "rows": total,
        "matched": matched,
        "unmatched": total - matched,
        "unmatched_pct": round((total - matched) / total * 100, 4) if total else 0.0,
    }
