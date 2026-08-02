"""Central configuration for the product portfolio profitability analysis.

Every path, constant, and column list used by the pipeline is declared here so
that no module hard codes a magic value. Paths are resolved relative to the
repository root, which makes the pipeline behave identically regardless of the
working directory it is launched from.
"""

from __future__ import annotations

from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

# config.py lives at <repo>/src/portfolio_profitability/config.py, so the
# repository root is three levels up.
REPO_ROOT: Path = Path(__file__).resolve().parents[2]

DATA_DIR: Path = REPO_ROOT / "data"
RAW_DATA_DIR: Path = DATA_DIR / "raw"
PROCESSED_DATA_DIR: Path = DATA_DIR / "processed"
IMAGES_DIR: Path = REPO_ROOT / "images"
NOTEBOOK_DIR: Path = REPO_ROOT / "notebook"
DOCS_DIR: Path = REPO_ROOT / "docs"

TRAINING_DATA_FILENAME: str = "training_data.csv"
METRICS_FILENAME: str = "metrics.json"

# ---------------------------------------------------------------------------
# Raw input files
# ---------------------------------------------------------------------------

RAW_FILES: dict[str, str] = {
    "customers": "customers_set_14.csv",
    "order_items": "order_items_set_14.csv",
    "orders": "orders_set_14.csv",
    "products": "products_set_14.csv",
    "sellers": "sellers_set_14.csv",
}

# Row and column counts observed in the recorded execution of the source
# notebook. These are used only to warn the operator when the loaded files do
# not match the dataset the published results were computed from. They are
# never used to alter a calculation.
EXPECTED_RAW_SHAPES: dict[str, tuple[int, int]] = {
    "customers": (11_904, 9),
    "order_items": (26_072, 7),
    "orders": (11_904, 8),
    "products": (1_990, 10),
    "sellers": (500, 8),
}

# ---------------------------------------------------------------------------
# Column names referenced by the analysis
# ---------------------------------------------------------------------------

ORDER_DATE_COLUMNS: list[str] = [
    "order_purchase_timestamp",
    "order_approved_at",
    "order_delivered_carrier_date",
    "order_delivered_customer_date",
    "order_estimated_delivery_date",
]

# Source timestamps are day first (D/M/YYYY). Parsing without this flag would
# silently transpose day and month for every day value of 12 or below.
DATE_IS_DAY_FIRST: bool = True

DELIVERED_STATUS: str = "delivered"
CANCELLED_STATUS: str = "canceled"

# ---------------------------------------------------------------------------
# Modelling configuration
# ---------------------------------------------------------------------------

RANDOM_STATE: int = 42
TEST_SIZE: float = 0.25
CV_FOLDS: int = 5

TARGET: str = "contribution_profit"

NUMERIC_FEATURES: list[str] = [
    "unit_gross_margin",
    "weight_g",
    "volume_cm3",
    "avg_discount_rate",
]

CATEGORICAL_FEATURES: list[str] = ["category"]

# pandas.get_dummies with drop_first=True removes the first category in sorted
# order. For this dataset that is "auto", which therefore becomes the baseline
# every category coefficient is measured against.
DUMMY_PREFIX: str = "cat"

# Columns shown in the product level correlation matrix.
CORRELATION_COLUMNS: list[str] = [
    "unit_gross_margin",
    "weight_g",
    "volume_cm3",
    "avg_discount_rate",
    "units_sold",
    "revenue",
    "contribution_profit",
]

# Column order of the exported product level training data.
EXPORT_COLUMNS: list[str] = [
    "product_no",
    "category",
    "unit_price",
    "unit_cost",
    "unit_gross_margin",
    "weight_g",
    "length_cm",
    "height_cm",
    "width_cm",
    "volume_cm3",
    "avg_discount_rate",
    "units_sold",
    "revenue",
    "gross_profit",
    "contribution_profit",
    "split",
]

# Hair et al. (2019) treat a variance inflation factor above this value as the
# point at which multicollinearity warrants investigation.
VIF_THRESHOLD: float = 10.0

# Weight band edges in grams, used for the fixed freight cost evidence table.
WEIGHT_BAND_EDGES: list[float] = [0, 500, 1_000, 5_000, 15_000]
WEIGHT_BAND_LABELS: list[str] = [
    "0-500 g",
    "501-1,000 g",
    "1,001-5,000 g",
    "5,001-15,000 g",
    "Above 15,000 g",
]

# ---------------------------------------------------------------------------
# Presentation
# ---------------------------------------------------------------------------

# The currency unit is not documented anywhere in the source data. The source
# notebook presented all monetary values as US dollars and that convention is
# preserved here so the figures remain comparable. See docs/DATA.md.
CURRENCY_LABEL: str = "USD"

FIGURE_DPI: int = 200
