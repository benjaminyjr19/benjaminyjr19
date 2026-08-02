#!/usr/bin/env python3
"""Generate notebook/MultipleLinearRegression.ipynb from this single source.

The notebook is a build artefact. Keeping its content here rather than editing
the JSON by hand has three benefits that matter for a repository meant to be
reviewed:

- The committed notebook always has cleared outputs and no execution counts,
  because they are never written in the first place.
- Cell identifiers are stable, so a content change produces a small readable
  diff instead of a churned JSON blob.
- Regeneration is deterministic and is asserted by
  ``tests/test_repository.py::test_the_committed_notebook_matches_its_generator``.

Run it with:

    python scripts/build_notebook.py

If you edit the notebook in Jupyter instead, port the change back into this file
before committing, or the integrity test will fail.
"""

from __future__ import annotations

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
OUT = REPO_ROOT / "notebook" / "MultipleLinearRegression.ipynb"

cells = []


def md(text):
    cells.append({"cell_type": "markdown", "metadata": {}, "source": text.strip("\n").split("\n")})


def code(text):
    cells.append({
        "cell_type": "code",
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": text.strip("\n").split("\n"),
    })


# Store sources with trailing newlines the way nbformat does.
def finalise(source_lines):
    return [line + "\n" for line in source_lines[:-1]] + [source_lines[-1]]


# ---------------------------------------------------------------------------

md("""
# Product Portfolio Profitability: Multiple Linear Regression

Predicting the lifetime contribution profit of a product from the
characteristics a Chief Financial Officer can observe before committing
investment to a range.

| Item | Detail |
|---|---|
| Module | BM4088 Predictive Analytics, In Course Assessment 2 |
| Assignment group | BD |
| Business scenario | Product Portfolio Profitability |
| Decision maker | Chief Financial Officer |
| Method | Multiple linear regression, ordinary least squares |
| Target variable | Total contribution profit per product |

Authors: Amanda Ng Shu Ping, Keane Tan, Mutiara Cahaya Hasdinda, Zoe Tay Yee Xuan.

## Purpose of This Notebook

This notebook implements the predictive analytics component of the CRISP-DM
lifecycle. It builds a multiple linear regression model that estimates the
contribution profit a product generates across its lifetime on the platform.

The analytical logic lives in the `portfolio_profitability` package under
`src/`, where it is unit tested. This notebook is the narrative that calls it,
so the code you read here is the same code the test suite exercises.

## Before You Run

The five source files are not distributed with this repository. Place them in
`data/raw/` before running:

- `customers_set_14.csv`
- `order_items_set_14.csv`
- `orders_set_14.csv`
- `products_set_14.csv`
- `sellers_set_14.csv`

See `docs/DATA.md` for the schema and `docs/REPRODUCIBILITY.md` for setup.

## A Note on the Committed Outputs

Every code cell in the committed copy of this notebook has its output cleared.
This is deliberate. The source files are not in the repository, so a committed
output could not be regenerated or checked by a reader, and an output that no
longer matched the code beside it would be worse than no output at all. The
results of the original recorded execution are transcribed in `docs/RESULTS.md`
together with the one figure that survives as a rendered image.
""")

md("## 1. Environment Setup")

code('''
import sys
from pathlib import Path


def find_repository_root(start: Path) -> Path:
    """Locate the repository root from wherever the kernel was launched."""
    for candidate in (start, *start.parents):
        if (candidate / "src" / "portfolio_profitability").is_dir():
            return candidate
    raise RuntimeError(
        "Could not locate the repository root. Start Jupyter from the "
        "repository root or from the notebook directory."
    )


REPO_ROOT = find_repository_root(Path.cwd().resolve())
SRC_DIR = REPO_ROOT / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

print("Repository root:", REPO_ROOT)
''')

code('''
import platform

import matplotlib
import numpy as np
import pandas as pd
import sklearn
import statsmodels
from IPython.display import display

from portfolio_profitability import (
    cleaning,
    data_loading,
    evaluation,
    features,
    modeling,
    plots,
)
from portfolio_profitability.config import (
    CORRELATION_COLUMNS,
    CV_FOLDS,
    EXPORT_COLUMNS,
    IMAGES_DIR,
    PROCESSED_DATA_DIR,
    RANDOM_STATE,
    RAW_DATA_DIR,
    TEST_SIZE,
    TRAINING_DATA_FILENAME,
    VIF_THRESHOLD,
)

pd.set_option("display.width", 160)
pd.set_option("display.max_columns", 40)
plots.apply_house_style()

# Warnings are deliberately left visible. Suppressing them wholesale hides real
# problems, and nothing in this notebook depends on a deprecated interface.

print(f"Python       {platform.python_version()}")
print(f"pandas       {pd.__version__}")
print(f"numpy        {np.__version__}")
print(f"scikit-learn {sklearn.__version__}")
print(f"statsmodels  {statsmodels.__version__}")
print(f"matplotlib   {matplotlib.__version__}")
print()
print(f"Random seed        {RANDOM_STATE}")
print(f"Holdout proportion {TEST_SIZE:.0%}")
print(f"Raw data directory {RAW_DATA_DIR}")
''')

md("""
## 2. Load the Raw Data

The loader resolves one documented location, `data/raw/`, and fails with an
explicit message naming the missing files if any are absent. It then reports
whether the loaded tables match the dataset the published results were computed
from. That check exists so that nobody can accidentally publish numbers derived
from a different or a synthetic input.
""")

code('''
raw = data_loading.load_raw_tables()

for name, frame in raw.items():
    print(f"{name:12s} {frame.shape[0]:>6,} rows  x {frame.shape[1]:>2} columns")
print()
print(data_loading.provenance_report(raw))
''')

md("""
## 3. Data Understanding

Data quality is profiled before any cleansing. Two problems drive the cleansing
decisions in Section 4: missing order keys on some order lines, and missing
cost on some products.
""")

code('''
print("MISSING VALUES BY TABLE")
missing_report = data_loading.missing_value_report(raw)
if missing_report.empty:
    print("  No missing values in any table")
else:
    display(missing_report)

print("EXACT DUPLICATE ROWS")
display(data_loading.duplicate_row_report(raw))

integrity = data_loading.referential_integrity(raw["order_items"], raw["orders"])
print("REFERENTIAL INTEGRITY (order_items to orders)")
print(
    f"  matched {integrity['matched']:,} of {integrity['rows']:,} rows  "
    f"({integrity['unmatched_pct']:.2f}% unmatched)"
)
''')

md("""
## 4. Data Preparation

### 4.1 Cleansing Activity 1: Remove Order Items With No Parent Order

Order lines that carry a null order key cannot be attributed to a customer, an
order status, or a purchase date, so they cannot enter a revenue calculation.
They are removed rather than imputed because there is no defensible basis for
inventing an order identifier.
""")

code('''
order_items, drop_report = cleaning.drop_unattributable_order_items(raw["order_items"])

print(
    f"Removed {drop_report.removed:,} unattributable rows "
    f"({drop_report.removed_pct:.2f}% of order_items)"
)
print(f"Retained {drop_report.rows_after:,} rows")
''')

md("""
### 4.2 Cleansing Activity 2: Impute Missing Product Cost

Cost is the denominator of every margin measure, so dropping products without a
cost would silently remove them from the profitability analysis and bias the
category totals. The median cost of the same product category is used because
cost is strongly right skewed, which makes the median more stable than the mean.

If an entire category had no recorded cost the category median would itself be
undefined. The implementation falls back to the global median in that case and
reports how many rows it affected, so the step can never leave a null behind
without saying so.
""")

code('''
products, imputation_report = cleaning.impute_missing_cost(raw["products"])

print(
    f"Imputed {imputation_report.imputed:,} missing cost values "
    f"({imputation_report.imputed_pct:.2f}% of products)"
)
print(
    f"Mean cost   before {imputation_report.mean_before:9.2f}   "
    f"after {imputation_report.mean_after:9.2f}"
)
print(
    f"Median cost before {imputation_report.median_before:9.2f}   "
    f"after {imputation_report.median_after:9.2f}"
)
print(
    f"Rows that fell back to the global median: "
    f"{imputation_report.fell_back_to_global_median}"
)
print()
print("Category median cost used for imputation:")
display(
    cleaning.category_median_cost(raw["products"]).round(2).to_frame("median_cost")
)
''')

md("""
### 4.3 Parse Dates and Build the Fact Table

Source timestamps are day first in `D/M/YYYY` form, so day first parsing is
required. Parsing them month first would silently transpose day and month for
every date whose day component is twelve or below, which would corrupt any time
based analysis without raising an error.

The cleaned tables are then joined into a single order item level fact table.
""")

code('''
orders = cleaning.parse_order_dates(raw["orders"])

purchase = orders["order_purchase_timestamp"]
print("Purchase dates span", purchase.min().date(), "to", purchase.max().date())
print("Unparsed timestamps:", int(purchase.isna().sum()))
print()

order_item_facts = cleaning.build_order_item_facts(order_items, products, orders)
print(f"Fact table: {len(order_item_facts):,} order item rows")
display(order_item_facts["order_status"].value_counts().to_frame("rows"))
''')

md("""
### 4.4 Derive the Financial Measures

Three measures carry the whole analysis.

| Measure | Formula | Meaning |
|---|---|---|
| Net revenue | `price x (1 - discount_rate)` | Revenue actually recognised after discount |
| Gross profit | `net revenue - cost_clean` | Profit after the cost of the goods |
| Contribution profit | `gross profit - freight_value` | Profit after fulfillment is charged |

Only delivered orders are retained. Cancelled orders never generate recognised
revenue, so including them would overstate every category total.

The currency unit is not documented anywhere in the source files. All monetary
values are presented in US dollars, following the convention of the original
analysis. See `docs/DATA.md` for this and the other recorded assumptions.
""")

code('''
order_item_facts = cleaning.add_financial_measures(order_item_facts)

delivered = cleaning.select_delivered(order_item_facts)
cancelled = cleaning.select_cancelled(order_item_facts)
totals = cleaning.portfolio_totals(delivered)

print(f"Delivered order items      {totals['order_items']:>12,}")
print(
    f"Cancelled order items      {len(cancelled):>12,}   "
    f"({cancelled['net_revenue'].sum():,.2f} not recognised)"
)
print()
print(f"Net revenue                {totals['net_revenue']:>15,.2f}")
print(f"Cost of goods sold         {totals['cogs']:>15,.2f}")
print(
    f"Gross profit               {totals['gross_profit']:>15,.2f}   "
    f"({totals['gross_margin_pct']:5.2f}% margin)"
)
print(
    f"Freight cost               {totals['freight']:>15,.2f}   "
    f"({totals['freight_pct_of_revenue']:5.2f}% of revenue)"
)
print(
    f"Contribution profit        {totals['contribution_profit']:>15,.2f}   "
    f"({totals['contribution_margin_pct']:5.2f}% margin)"
)
''')

md("""
### 4.5 Category Summary

This table is the descriptive analytics the business hypotheses are tested
against, and it is the figure set that the accompanying Power BI report
reproduces.
""")

code('''
category_table = features.category_summary(delivered)
display(category_table.round(2))

figure = plots.plot_category_contribution(category_table)
print("Saved:", plots.save_figure(figure, "category-contribution-profit.png", close=False))
figure
''')

md("""
### 4.6 Evidence on Whether Freight Scales With Product Size

One of the business hypotheses claims that fulfillment cost does not scale with
product size. If that holds, the correlation between freight and the physical
attributes is near zero and the average freight is close to flat across weight
bands.

The band edges are unbounded at both ends. In the source notebook they were
closed at zero and sixty thousand grams, which would have silently dropped any
product outside that range from the table without changing the reported total.
The implementation now raises rather than drops, and asserts that the band unit
counts reconcile to the input rows.
""")

code('''
correlations = features.freight_correlations(delivered)
print("Correlation of freight_value with:")
for label, value in correlations.items():
    print(f"  {label:18s} {value:+.3f}")
print()

band_table = features.freight_by_weight_band(delivered)
display(band_table.round(2))

mean_freight = float(delivered["freight_value"].mean())
print(f"Portfolio mean freight per unit: {mean_freight:,.2f}")

figure = plots.plot_freight_by_weight_band(band_table, mean_freight)
print("Saved:", plots.save_figure(figure, "freight-by-weight-band.png", close=False))
figure
''')

md("""
## 5. Modelling

### 5.1 Unit of Analysis and Target Variable

The Chief Financial Officer invests in products rather than in individual
transactions, so each row of the training set is one product. The target
variable is total contribution profit, the profit a product has generated
across every delivered order after both cost of goods and fulfillment are
charged against it. That is the figure a portfolio investment decision turns on.

Units sold is deliberately excluded from the explanatory variables. Demand is
not observable at the point a range decision is made, and including it would let
the model use information the decision maker does not have. Section 7 records
the consequence of that choice, which is that the target itself embeds demand
while the features do not.

The product level aggregation takes the first observed price and cost for each
product. That is exact only when a product carries a single price throughout,
so the notebook counts any product that does not and reports it rather than
letting an arbitrary representative price pass unnoticed.
""")

code('''
varying_price = features.count_products_with_varying_price(delivered)
if varying_price:
    print(
        f"NOTICE: {varying_price:,} products appear at more than one price. "
        "Unit price and unit cost take the first observed value, so those "
        "products carry an arbitrary representative price."
    )
else:
    print(
        "Every product carries a single price across all delivered lines, so "
        "taking the first observed price and cost is exact."
    )
print()

product_level = features.build_product_level(delivered)
print(f"{len(product_level):,} products with at least one delivered sale")
display(product_level.head())
''')

md("""
### 5.2 Explanatory Variables

| Variable | Type | Why it is included |
|---|---|---|
| `unit_gross_margin` | Continuous | Dollar margin the product earns per sale. It replaces price and cost as a single term, which removes the severe collinearity those two carry when entered separately. |
| `weight_g` | Continuous | Tests whether physical size drives profitability through fulfillment. |
| `volume_cm3` | Continuous | Dimensional bulk, the second physical driver of shipping economics. |
| `avg_discount_rate` | Continuous | Average promotional depth applied to the product. |
| `category` | Categorical, one hot | Captures category effects that remain after margin and size are held constant. |

One category is dropped and becomes the baseline that every other category
coefficient is measured against. The dropped category is reported below rather
than assumed.
""")

code('''
design_matrix, target = features.build_design_matrix(product_level)

print(f"Design matrix: {design_matrix.shape[0]:,} rows x {design_matrix.shape[1]} columns")
print(f"Baseline (dropped) category: {features.baseline_category(product_level)}")
print()
print("Columns:", list(design_matrix.columns))

figure = plots.plot_correlation_heatmap(
    product_level, CORRELATION_COLUMNS, title="Product Level Correlation Matrix"
)
print("Saved:", plots.save_figure(figure, "correlation-heatmap.png", close=False))
figure
''')

md("""
### 5.3 Train and Test Split

The data is split with a fixed random seed. The holdout set is never used in
fitting, so the test metrics measure how the model behaves on products it has
not seen.

The exported training data is written to `data/processed/` rather than to the
working directory, so the export lands in the same place no matter where the
kernel was started.
""")

code('''
train_x, test_x, train_y, test_y = modeling.split_data(design_matrix, target)

print(
    f"Training set  {len(train_x):>5,} products  "
    f"({len(train_x) / len(design_matrix) * 100:.0f}%)"
)
print(
    f"Holdout set   {len(test_x):>5,} products  "
    f"({len(test_x) / len(design_matrix) * 100:.0f}%)"
)
print()

holdout_index = set(test_x.index)
training_export = product_level.copy()
training_export["split"] = [
    "test" if index in holdout_index else "train" for index in training_export.index
]

PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)
export_path = PROCESSED_DATA_DIR / TRAINING_DATA_FILENAME
training_export[EXPORT_COLUMNS].to_csv(export_path, index=False)
print("Written:", export_path)

display(training_export[EXPORT_COLUMNS].head(10))
''')

md("### 5.4 Fit the Multiple Linear Regression Model")

code('''
model = modeling.fit_linear_regression(train_x, train_y)
coefficients = modeling.coefficient_table(model, design_matrix.columns)

print(f"Intercept: {model.intercept_:,.2f}")
display(coefficients.round(4))

figure = plots.plot_effect_sizes(coefficients, design_matrix)
print("Saved:", plots.save_figure(figure, "effect-sizes.png", close=False))
figure
''')

md("""
### 5.5 Model Evaluation

Four metrics are reported. R squared states how much of the variation in product
contribution profit the model explains. Root mean squared error and mean
absolute error state the size of the typical error in dollars, which is what
makes the result usable to a Chief Financial Officer.

Adjusted R squared is shown for the training set only. It corrects for the
degrees of freedom the model consumed while fitting, and a holdout set consumed
none, so the quantity is undefined there rather than merely unreported.

Cross validation runs over the full product set. It is a stability check on the
whole sample and confirms that the training result is not an artefact of one
favourable split. It is not an independent confirmation of the holdout metrics,
because the holdout rows take part in it.
""")

code('''
predicted_train = model.predict(train_x)
predicted_test = model.predict(test_x)

metrics = evaluation.regression_metrics(
    train_y, predicted_train, test_y, predicted_test, design_matrix.shape[1]
)
display(metrics.round(3))

cross_validation = evaluation.cross_validated_r2(design_matrix, target)
print(
    f"{CV_FOLDS} fold cross validated R squared: "
    f"{cross_validation['mean_r2']:.3f} "
    f"(standard deviation {cross_validation['std_r2']:.3f})"
)
print(f"Fold scores: {np.round(cross_validation['fold_scores'], 3)}")
print()

holdout_mae = float(metrics.loc[metrics["metric"] == "MAE", "holdout"].iloc[0])
print(f"Target standard deviation: {target.std():,.2f}")
print(
    f"Holdout MAE as a share of that spread: "
    f"{evaluation.error_relative_to_spread(target, holdout_mae):.1f}%"
)
''')

md("""
### 5.6 Statistical Significance and Multicollinearity

`statsmodels` reports the standard errors, t statistics, and p values that
scikit-learn omits. Fitting the identical design matrix gives identical point
estimates, so the two views describe one model.

Variance inflation factors measure how far each explanatory variable is
explained by the others. Hair et al. (2019) treat a factor above ten as the
point at which multicollinearity warrants investigation. The cell flags any
variable that crosses that threshold rather than asserting in advance that none
do. Section 7 records what the recorded run found.

A high variance inflation factor on a one hot indicator is expected behaviour
rather than a defect. Indicators from the same categorical variable are
mutually exclusive, so each one is partly predictable from the others by
construction. It does not bias the coefficients, and it inflates their standard
errors only for the affected terms.
""")

code('''
ols = modeling.fit_ols_summary(train_x, train_y)
print(ols.summary())

vif = modeling.variance_inflation_factors(design_matrix)
print()
print("VARIANCE INFLATION FACTORS")
display(vif.round(2))

above_threshold = vif[vif["vif"] > VIF_THRESHOLD]
if above_threshold.empty:
    print(f"No variable exceeds the threshold of {VIF_THRESHOLD:.0f}.")
else:
    print(f"Variables above the threshold of {VIF_THRESHOLD:.0f}:")
    for _, row in above_threshold.iterrows():
        print(f"  {row['variable']:20s} {row['vif']:6.2f}")
''')

md("""
### 5.7 Diagnostic Plots

Axis limits are derived from the data rather than fixed in advance, so these
figures remain correct if the underlying data changes.
""")

code('''
figure = plots.plot_holdout_diagnostics(test_y, predicted_test)
print("Saved:", plots.save_figure(figure, "holdout-diagnostics.png", close=False))
figure
''')

code('''
figure = plots.plot_residual_distribution(test_y, predicted_test)
print("Saved:", plots.save_figure(figure, "residual-distribution.png", close=False))
figure
''')

code('''
figure = plots.plot_actual_versus_predicted_by_rank(test_y, predicted_test)
print("Saved:", plots.save_figure(figure, "actual-versus-predicted-ranked.png", close=False))
figure
''')

md("""
### 5.8 Directional Accuracy

For a portfolio screening decision the sign of the prediction matters more than
its exact value. The decision maker needs to know whether a product will make
money or lose money.

The headline figure is measured on the holdout set. The source notebook computed
it across the full product set, which mixes rows the model was fitted on into
the score and reports an optimistically biased number. The full sample figure is
still shown below, clearly labelled, so the two can be compared.
""")

code('''
predicted_all = model.predict(design_matrix)

holdout_direction = evaluation.directional_accuracy(test_y, predicted_test)
full_direction = evaluation.directional_accuracy(target, predicted_all)

for label, result in [("HOLDOUT", holdout_direction), ("FULL SAMPLE", full_direction)]:
    print(f"{label} ({result['n']:,} products)")
    print(
        f"  Products that actually lose money:       "
        f"{result['actual_loss_making']:,} "
        f"({result['actual_loss_making'] / result['n'] * 100:.2f}%)"
    )
    print(f"  Products the model flags as loss making: {result['predicted_loss_making']:,}")
    print(f"  Directional accuracy:                    {result['accuracy_pct']:.2f}%")
    print()

concentration = evaluation.concentration_summary(product_level)
print(
    f"Share of products that are contribution positive: "
    f"{concentration['contribution_positive_product_pct']:.2f}%"
)
print(
    f"Share of revenue earned by contribution positive products: "
    f"{concentration['revenue_share_of_positive_pct']:.2f}%"
)
''')

md("""
## 6. Business Interpretation

### 6.1 What the Coefficients Say

Every coefficient is read as the change in a product's lifetime contribution
profit for a one unit change in that variable, holding everything else constant.

Category coefficients are read against the dropped baseline category, not
against zero and not against each other.
""")

code('''
margin_coefficient = float(
    coefficients.loc[coefficients["variable"] == "unit_gross_margin", "coefficient"].iloc[0]
)
print(
    f"Each additional 1.00 of unit gross margin is associated with "
    f"{margin_coefficient:,.2f} of extra lifetime contribution profit."
)
print()

baseline = features.baseline_category(product_level)
print(
    f"CATEGORY EFFECT RELATIVE TO THE {baseline.upper()} BASELINE, "
    "AFTER UNIT MARGIN AND SIZE ARE HELD CONSTANT"
)
display(modeling.category_effects(coefficients).round(2))

print("PHYSICAL ATTRIBUTES")
for variable in ["weight_g", "volume_cm3"]:
    value = float(
        coefficients.loc[coefficients["variable"] == variable, "coefficient"].iloc[0]
    )
    p_value = float(ols.pvalues[variable])
    print(f"  {variable:12s} {value:+.4f} per unit of measure   p = {p_value:.3f}")
''')

md("""
The category coefficients are net of unit margin and physical size. A common
explanation for a negative category effect is that the category sells in low
volume, since the target is a lifetime total rather than a per unit figure. That
explanation is testable, so the next cell tests it instead of asserting it.
""")

code('''
volume_by_category = features.units_per_product_by_category(product_level)
effects = modeling.category_effects(coefficients)

comparison = volume_by_category.merge(effects, on="category", how="left")
comparison = comparison.rename(columns={"coefficient": "model_effect"})
display(comparison.round(2))

with_effect = comparison.dropna(subset=["model_effect"])
if len(with_effect) > 2:
    rank_correlation = with_effect["mean_units_per_product"].corr(
        with_effect["model_effect"], method="spearman"
    )
    print(
        "Spearman rank correlation between mean units per product and the "
        f"fitted category effect: {rank_correlation:+.3f}"
    )
    print(
        "A strong positive value supports the sales volume explanation. "
        "A weak value means the category effect is not explained by volume "
        "alone and should not be described as if it were."
    )
print()
print(
    f"The {baseline} baseline has no coefficient of its own, so it carries no "
    "model effect in the table above."
)
''')

md("""
### 6.2 Implications for the Chief Financial Officer

The figures quoted in this section come from the recorded execution of the
original notebook against the source dataset. They are transcribed in full,
with their provenance, in `docs/RESULTS.md`. Re-running this notebook against
the same five files reproduces them.

__The model is good enough to screen a range and should not be used to forecast
a single product.__ It explained roughly three quarters of the variation in
product contribution profit, with a holdout R squared of 0.773 and a five fold
cross validated R squared of 0.779. The dollar error on any one product remains
large relative to the average product, with a holdout mean absolute error of
527.88 against a target standard deviation of 1,927.49, which is 27.4 percent of
the spread. Demand is the missing term and demand is not observable in advance.

__Unit gross margin dominates every other variable.__ Each additional dollar of
unit gross margin was associated with 16.49 dollars of additional lifetime
contribution profit, and the term was significant at any conventional level.
Weight and volume were not statistically distinguishable from zero, with p
values of 0.126 and 0.093. This points the profitability problem at pricing and
sourcing rather than at logistics engineering.

__Fulfillment, not cost of goods, is where the portfolio loses its profit.__
Net revenue of 10,636,275.41 became 2,783,738.52 of gross profit, a 26.17
percent margin. Freight of 2,639,540.99 then consumed 94.8 percent of that gross
profit, leaving 144,197.53 of contribution profit on a 1.36 percent margin. Only
electronics and furniture were contribution positive. The remaining five
categories lost money once freight was charged against them.

__Freight behaves as a fixed charge per item across most of the range.__ Freight
correlated at 0.070 with weight, 0.022 with volume, and minus 0.003 with price.
Average freight sat between 107.19 and 108.56 across the four bands below
fifteen kilograms and rose to 124.09 above it, so the charge is close to flat
below fifteen kilograms rather than flat everywhere.

__Furniture carried the largest negative category effect.__ Holding unit margin
and physical size constant, a furniture product returned about 1,788 dollars
less lifetime contribution than an equivalent product in the baseline category.
Electronics and books carried positive effects of about 461 and 476 dollars.
Section 6.1 tests whether sales volume explains the ordering of these effects
rather than assuming it does.

The full discussion, including the recommendations put to the Chief Financial
Officer, is in the written report that accompanies this assessment. That report
is not part of this repository.
""")

md("""
## 7. Assumptions and Limitations

These are the constraints a reader needs in order to judge what the model can
and cannot support. Each one is a property of the data or the design rather than
a defect in the implementation.

1. __The target embeds demand while the features do not.__ Total contribution
   profit is close to units sold multiplied by per unit contribution. Units sold
   is excluded from the features by design, because it is not observable when a
   range decision is made. The model therefore predicts a quantity whose largest
   driver is deliberately withheld from it, which sets a ceiling on achievable
   accuracy and is the main reason per product dollar errors stay large.
2. __The relationship is assumed linear and additive.__ Ordinary least squares
   fits no interaction and no curvature. A margin effect that differs by
   category would not be captured.
3. __Residuals are not normally distributed.__ The recorded run reported an
   Omnibus statistic of 619.47 with a p value below 0.001, skew of 1.17, and
   kurtosis of 24.97. Coefficient point estimates stay unbiased under ordinary
   least squares, but the p values and confidence intervals rest on an
   assumption the data does not meet, so they should be read as indicative.
   Heteroscedasticity robust standard errors would be the natural next step.
4. __Two variance inflation factors exceeded ten in the recorded run.__
   `avg_discount_rate` reached 10.53 and `cat_fashion` reached 11.65, and
   statsmodels reported a condition number of 2.93e+06. The source notebook
   stated that no variable was a near linear combination of the others, which
   the same cell's own output contradicts. For the one hot indicators this is
   expected, since indicators from one categorical variable are mutually
   exclusive by construction. It inflates standard errors on the affected terms
   and does not bias the coefficients.
5. __Cost is imputed for a subset of products.__ The recorded run imputed 99 of
   1,990 products, which is 4.97 percent. Those products carry a category median
   cost rather than a measured one, so their margin and contribution profit are
   estimates.
6. __Unit price and unit cost are single values per product.__ Any product sold
   at more than one price would carry an arbitrary representative price. The
   notebook counts and reports such products in Section 5.1.
7. __The currency unit is undocumented.__ Nothing in the source files states a
   currency. All amounts follow the original analysis in being presented as US
   dollars, which is a presentation convention rather than a verified fact.
8. __Cancelled orders are excluded entirely.__ The analysis measures recognised
   revenue, so the cost of cancellations does not appear anywhere in the model.
9. __The dataset provenance is not documented.__ The source notebook does not
   state where the five files originate, and it could not be verified. See
   `docs/DATA.md`.
10. __The holdout is a random split rather than a time based one.__ Purchase
    dates span several years, so a chronological split would be a stricter test
    of whether the model generalises forward in time.

## 8. Future Work

1. Add a second stage that predicts units sold from observable characteristics,
   then combine it with a per unit contribution model. That addresses the
   ceiling described in limitation one directly.
2. Refit with heteroscedasticity robust standard errors, given the residual
   diagnostics in limitation three.
3. Model contribution profit per unit alongside the lifetime total, which
   separates the pricing question from the demand question.
4. Compare against a regularised linear model and a gradient boosted tree to
   quantify how much of the remaining error is non linearity rather than
   missing information.
5. Evaluate on a chronological holdout to test forward generalisation.
6. Test interactions between unit gross margin and category, which is the most
   plausible missing term given the size of the category effects.

## 9. References

Hair, J. F., Black, W. C., Babin, B. J., and Anderson, R. E. (2019).
*Multivariate data analysis* (8th ed.). Cengage Learning.

Pedregosa, F., Varoquaux, G., Gramfort, A., Michel, V., Thirion, B., Grisel, O.,
Blondel, M., Prettenhofer, P., Weiss, R., Dubourg, V., Vanderplas, J., Passos,
A., Cournapeau, D., Brucher, M., Perrot, M., and Duchesnay, E. (2011).
Scikit-learn: Machine learning in Python. *Journal of Machine Learning
Research*, *12*, 2825 to 2830.

Seabold, S., and Perktold, J. (2010). Statsmodels: Econometric and statistical
modeling with Python. In *Proceedings of the 9th Python in Science Conference*
(pp. 92 to 96). https://doi.org/10.25080/Majora-92bf1922-011

The CRISP-DM process referenced in Section 1 is described in Chapman, P.,
Clinton, J., Kerber, R., Khabaza, T., Reinartz, T., Shearer, C., and Wirth, R.
(2000). *CRISP-DM 1.0: Step-by-step data mining guide*. SPSS Inc.
""")

# nbformat 4.5 requires a stable id on every cell. Index based ids keep the
# JSON diff readable when the notebook is rebuilt.
notebook = {
    "cells": [
        {
            "id": f"cell-{index:02d}",
            **cell,
            "source": finalise(cell["source"]),
        }
        for index, cell in enumerate(cells)
    ],
    "metadata": {
        "kernelspec": {
            "display_name": "Python 3",
            "language": "python",
            "name": "python3",
        },
        "language_info": {
            "codemirror_mode": {"name": "ipython", "version": 3},
            "file_extension": ".py",
            "mimetype": "text/x-python",
            "name": "python",
            "nbconvert_exporter": "python",
            "pygments_lexer": "ipython3",
        },
    },
    "nbformat": 4,
    "nbformat_minor": 5,
}

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(notebook, indent=1, ensure_ascii=False) + "\n")
print(f"Wrote {OUT} with {len(cells)} cells "
      f"({sum(1 for c in cells if c['cell_type'] == 'code')} code, "
      f"{sum(1 for c in cells if c['cell_type'] == 'markdown')} markdown)")
