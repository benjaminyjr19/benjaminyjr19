# Product Portfolio Profitability

A multiple linear regression that estimates the lifetime contribution profit of
a product from characteristics a Chief Financial Officer can observe before
committing investment to a range.

The analysis finds a portfolio that is revenue rich and profit poor: 10.64
million in net revenue becomes 2.78 million of gross profit, and fulfillment
then consumes 94.8 percent of that, leaving 144,197.53 of contribution profit on
a 1.36 percent margin. Only two of seven categories are contribution positive.

![Predicted versus actual and residuals versus fitted values, holdout set](images/holdout-diagnostics-recorded-run.png)

## Table of Contents

- [Read This First](#read-this-first)
- [Business Motivation](#business-motivation)
- [Problem Statement](#problem-statement)
- [Dataset](#dataset)
- [Repository Structure](#repository-structure)
- [Installation](#installation)
- [Execution](#execution)
- [Methodology](#methodology)
- [Results](#results)
- [Testing](#testing)
- [Continuous Integration](#continuous-integration)
- [Corrections to the Original Analysis](#corrections-to-the-original-analysis)
- [Limitations](#limitations)
- [Future Work](#future-work)
- [Acknowledgments](#acknowledgments)
- [License](#license)
- [References](#references)

## Read This First

Two constraints shape what this repository can and cannot show you. Both are
stated here rather than buried, because they determine how much weight the
numbers carry.

__The source data is not included.__ The five CSV files were supplied as
coursework assessment material and no redistribution licence for them could be
confirmed. Nothing in this repository reproduces them, and no synthetic
substitute is presented as if it were them.

__The results were recorded, not recomputed here.__ Every figure in
[docs/RESULTS.md](docs/RESULTS.md) is transcribed from the recorded execution of
the source notebook against the real files. Because those files were not
available, the analysis was not re-run while building this repository.

What __was__ verified, and can be verified by anyone who clones this:

- The implementation is covered by 127 passing tests
- The notebook executes end to end from a clean kernel with no manual steps
- The pipeline is deterministic, asserted by running it twice and comparing bytes
- Every recorded total reconciles arithmetically against the others, listed under
  "Internal Consistency Checks" in [docs/RESULTS.md](docs/RESULTS.md)
- Every relative path, link, and referenced image resolves

What was __not__ verified: that re-running against the real files reproduces
those exact numbers. That requires the files.

Where the recorded run did not compute something, this repository says so and
does not estimate it. The holdout directional accuracy is the clearest case. See
[docs/RESULTS.md](docs/RESULTS.md).

## Business Motivation

An online marketplace sells 1,990 products across seven categories. Revenue is
healthy and profit is not.

| Measure | Amount | Margin |
|---|---|---|
| Net revenue | 10,636,275.41 | |
| Cost of goods sold | 7,852,536.89 | |
| Gross profit | 2,783,738.52 | 26.17% |
| Freight cost | 2,639,540.99 | 24.82% of revenue |
| Contribution profit | 144,197.53 | 1.36% |

Fulfillment consumes 94.8 percent of gross profit. Only electronics and
furniture are contribution positive. The other five categories lose money once
freight is charged against them, and books loses 3.29 dollars of contribution
for every dollar of revenue it earns.

The Chief Financial Officer has to decide which products to keep, cut, reprice,
or invest in. That decision is made before demand is known.

## Problem Statement

Can the lifetime contribution profit of a product be predicted from
characteristics observable at the point a range decision is made, accurately
enough to screen a portfolio?

Three framing decisions follow, and each one is a constraint rather than a
convenience.

1. __The unit of analysis is the product.__ Investment decisions are made about
   products, so the model is fitted at that grain, one row per product.
2. __The target is total contribution profit.__ Profit after both cost of goods
   and fulfillment, summed across every delivered order for that product.
3. __Units sold is excluded from the features.__ Demand is not observable when
   the decision is made. Including it would let the model use information the
   decision maker does not have.

Decision three has a cost that is stated rather than hidden. The target embeds
demand while the features do not, which caps achievable accuracy by design. It
is why the model is presented as a screening tool and not as a forecast.

## Dataset

Five related tables in a transactional star schema. Full schema, derived fields,
and recorded assumptions are in [docs/DATA.md](docs/DATA.md).

| Table | Rows | Columns | Role |
|---|---|---|---|
| customers | 11,904 | 9 | Data quality profile only |
| order_items | 26,072 | 7 | Order lines. Price, freight, discount |
| orders | 11,904 | 8 | Order header. Status and timestamps |
| products | 1,990 | 10 | Product master. Category, cost, dimensions |
| sellers | 500 | 8 | Data quality profile only |

Purchase dates span 2019-01-01 to 2025-12-31. After cleansing and filtering to
delivered lines, the fact table holds 24,231 order lines covering 1,988
products.

__Provenance is not documented.__ The source notebook does not state where the
files came from, and it could not be verified. No citation is given for the
dataset, because inventing one would be worse than admitting the gap.

To run the analysis, place the files in `data/raw/`:

```
data/raw/customers_set_14.csv
data/raw/order_items_set_14.csv
data/raw/orders_set_14.csv
data/raw/products_set_14.csv
data/raw/sellers_set_14.csv
```

The loader compares what it finds against the recorded table shapes and prints a
clear warning if they differ, so results from a different input cannot be
mistaken for the published ones.

## Repository Structure

```
product-portfolio-profitability/
├── .github/workflows/
│   └── ci.yml                          Tests, notebook execution, integrity checks
├── data/
│   ├── raw/                            Place the five source CSV files here
│   └── processed/                      Pipeline output. Not committed
├── docs/
│   ├── DATA.md                         Schema, provenance, recorded assumptions
│   ├── METHODOLOGY.md                  CRISP-DM walkthrough and design decisions
│   ├── RESULTS.md                      Recorded results with provenance and checks
│   ├── CHANGES.md                      Every change made to the source notebook
│   └── REPRODUCIBILITY.md              Setup, determinism, known constraints
├── images/
│   ├── holdout-diagnostics-recorded-run.png    The one figure from the real data
│   └── README.md                       What each figure shows and how to generate it
├── notebook/
│   └── MultipleLinearRegression.ipynb  The analysis narrative. Outputs cleared
├── scripts/
│   ├── build_notebook.py               Generates the notebook. Single source of truth
│   ├── check_notebook_clean.py         Fails if the notebook carries outputs
│   └── check_requirements_pinned.py    Fails if any requirement is unpinned
├── src/portfolio_profitability/
│   ├── config.py                       Paths, constants, column lists
│   ├── data_loading.py                 Strict loading, profiling, provenance check
│   ├── cleaning.py                     Cleansing, joining, financial measures
│   ├── features.py                     Product aggregation, design matrix
│   ├── modeling.py                     Fitting, coefficients, multicollinearity
│   ├── evaluation.py                   Metrics, cross validation, directional accuracy
│   ├── plots.py                        Publication quality figures
│   └── pipeline.py                     End to end command line entry point
├── tests/                              127 tests across 9 modules
│   ├── synthetic_data.py               Test fixture. Never a source of results
│   └── test_*.py
├── environment.yml                     Conda environment, pinned
├── requirements.txt                    Runtime dependencies, pinned
├── requirements-dev.txt                Test dependencies, pinned
├── pyproject.toml                      Package metadata and pytest configuration
├── LICENSE
└── README.md
```

The analytical logic lives in `src/`, where it is unit tested, and the notebook
calls it. The code a reader sees in the notebook is the code the test suite
exercises.

## Installation

Requires Python 3.11 or 3.12. Python 3.11.15 is the version this repository was
verified against.

### Using pip

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

pip install -r requirements.txt -r requirements-dev.txt
pip install -e .                   # optional, puts the package on the path
```

### Using conda

```bash
conda env create -f environment.yml
conda activate portfolio-profitability
```

### Verify

```bash
pytest
```

All 127 tests should pass in well under a minute. They run without the source data.

__One dependency constraint is load bearing.__ statsmodels 0.14.4 imports a
scipy private helper that was removed in scipy 1.17, so scipy is pinned to
1.14.1. An unpinned install produces an environment where every statsmodels cell
fails at import. See [docs/REPRODUCIBILITY.md](docs/REPRODUCIBILITY.md).

## Execution

Place the five source files in `data/raw/` first.

### Command Line

```bash
python -m portfolio_profitability.pipeline
```

Writes `data/processed/training_data.csv`, `data/processed/metrics.json`, and
seven figures into `images/`.

```bash
python -m portfolio_profitability.pipeline --help
python -m portfolio_profitability.pipeline --data-dir /path/to/csvs
python -m portfolio_profitability.pipeline --no-figures
```

### Notebook

```bash
jupyter lab notebook/MultipleLinearRegression.ipynb
```

Run all cells. The notebook locates the repository root itself, so it works
whether the kernel starts in `notebook/` or in the repository root.

The notebook is generated from `scripts/build_notebook.py`, which is its single
source of truth. Generating it rather than hand editing the JSON guarantees the
committed file never carries outputs or execution counts, keeps cell identifiers
stable so content changes produce readable diffs, and makes regeneration
deterministic. A test asserts the committed notebook is byte identical to what
the generator produces, so the two cannot drift apart. If you edit the notebook
in Jupyter, port the change back into the generator before committing.

```bash
python scripts/build_notebook.py
```

## Methodology

Full detail in [docs/METHODOLOGY.md](docs/METHODOLOGY.md).

### Preprocessing

| Step | Action | Justification |
|---|---|---|
| Unattributable order lines | Removed 100 rows with a null order key, 0.38% | A line with no order key cannot be tied to a customer, status, or date, so it cannot enter a revenue calculation. There is no defensible basis for inventing an order identifier |
| Missing product cost | Imputed 99 values, 4.97%, with the median cost of the same category | Cost is the denominator of every margin measure. Dropping those products would remove them from the analysis and bias category totals. The median is used because cost is strongly right skewed |
| Date parsing | Day first | Month first parsing would transpose day and month for every date whose day is twelve or below, silently and without error |
| Joining | Inner joins to products and orders | A line that resolves to neither cannot be costed |
| Scope | Delivered lines only | Cancelled orders never generate recognised revenue |

The imputation falls back to the global median if an entire category has no
recorded cost, and reports how many rows that affected. In the recorded run the
count was zero.

### Feature Engineering

| Feature | Type | Rationale |
|---|---|---|
| `unit_gross_margin` | Continuous | Dollar margin per sale. Replaces price and cost as one term, which removes the severe collinearity they carry when entered separately |
| `weight_g` | Continuous | Tests whether physical size drives profitability through fulfillment |
| `volume_cm3` | Continuous | Dimensional bulk. Length times height times width |
| `avg_discount_rate` | Continuous | Average promotional depth applied to the product |
| `category` | Categorical, one hot | Category effects remaining after margin and size are held constant |

One category is dropped and becomes the baseline. For this dataset that is
`auto`. Every category coefficient is read against that baseline, not against
zero and not against each other.

### Model Training

Ordinary least squares multiple linear regression. 1,988 products, split 75 to
25 with seed 42, giving 1,491 training and 497 holdout products. The design
matrix is 10 columns.

Ordinary least squares has a closed form solution and no tuning surface, so
there are no hyperparameters. The only configuration is the split proportion and
the seed.

Linear regression was chosen because the deliverable is an explanation as much
as a prediction. The decision maker needs to know which lever moves profit and
by how much, and a coefficient answers that directly in dollars. A tree ensemble
would likely predict better and would not answer the question the decision
requires.

The model is fitted twice on the identical design matrix: with scikit-learn for
prediction, and with statsmodels for the standard errors, t statistics, and p
values scikit-learn does not expose. The test suite asserts the two agree.

### Evaluation

R squared, adjusted R squared, root mean squared error, mean absolute error,
five fold cross validated R squared, and directional accuracy. Adjusted R
squared is reported for the training set only, because a holdout set consumes no
degrees of freedom and the quantity is undefined there.

Directional accuracy is measured on the holdout set. The source notebook
measured it across the full sample, which includes the rows the model was fitted
on. See [Corrections](#corrections-to-the-original-analysis).

## Results

Full tables, with provenance and internal consistency checks, in
[docs/RESULTS.md](docs/RESULTS.md).

### Performance

| Metric | Training | Holdout |
|---|---|---|
| R squared | 0.789 | 0.773 |
| Adjusted R squared | 0.788 | Not applicable |
| RMSE | 917.689 | 802.879 |
| MAE | 568.349 | 527.883 |

Five fold cross validation over all 1,988 products gave a mean R squared of
0.779 with a standard deviation of 0.023. Fold scores were 0.783, 0.771, 0.751,
0.770, and 0.821, so the result does not depend on one favourable split.

Holdout mean absolute error of 527.883 is 27.4 percent of the target standard
deviation of 1,927.49. The model explains roughly three quarters of the variation
and still misses any individual product by a wide margin, which is exactly what
a screening tool looks like.

### Coefficients

| Variable | Coefficient | p value |
|---|---|---|
| Intercept | -1,326.4379 | 0.000 |
| `unit_gross_margin` | 16.4872 | 0.000 |
| `weight_g` | 0.0067 | 0.126 |
| `volume_cm3` | -0.0028 | 0.093 |
| `avg_discount_rate` | -3,425.0214 | 0.225 |
| `cat_books` | 476.4197 | 0.000 |
| `cat_electronics` | 461.3859 | 0.000 |
| `cat_fashion` | -413.0347 | 0.090 |
| `cat_furniture` | -1,788.2889 | 0.000 |
| `cat_home_goods` | -216.6982 | 0.022 |
| `cat_toys` | 45.0188 | 0.663 |

### What the Model Says

__Unit gross margin dominates.__ Each additional dollar of unit gross margin is
associated with 16.49 dollars of additional lifetime contribution profit, at any
conventional significance level.

__Physical size does not matter.__ Weight and volume are not statistically
distinguishable from zero, at p values of 0.126 and 0.093. This points the
profitability problem at pricing and sourcing rather than at logistics
engineering.

__Freight is close to a fixed charge per item.__ It correlates at 0.070 with
weight, 0.022 with volume, and -0.003 with price. Average freight sits between
107.19 and 108.56 across the four weight bands below fifteen kilograms and rises
to 124.09 above it.

__Category effects are large and net of margin.__ Holding unit margin and size
constant, a furniture product returns about 1,788 dollars less lifetime
contribution than an equivalent product in the baseline category. The notebook
tests whether sales volume explains the ordering of these effects rather than
asserting it.

__Revenue and profit are concentrated differently.__ 31.04 percent of products
are contribution positive, and they earn 81.32 percent of revenue.

## Testing

```bash
pytest                                          # all 127 tests
pytest tests/test_evaluation.py -v              # one module
pytest tests/test_notebook_execution.py         # execute the notebook end to end
```

| Module | Tests | Covers |
|---|---|---|
| `test_data_loading.py` | 9 | Strict loading, error messages, profiling, provenance check |
| `test_cleaning.py` | 13 | Cleansing, imputation including the fallback path, day first parsing, joins, financial identities |
| `test_features.py` | 14 | Aggregation, reconciliation, design matrix, baseline, weight banding |
| `test_modeling.py` | 9 | Split determinism, recovery of a known linear rule, statsmodels agreement, multicollinearity detection |
| `test_evaluation.py` | 14 | Metric closed forms, statsmodels agreement on adjusted R squared, directional accuracy |
| `test_plots.py` | 12 | Every figure builds and writes a valid PNG, derived axis limits, neutral diverging midpoint |
| `test_pipeline.py` | 8 | End to end run, artefact contents, byte level determinism, error exit code |
| `test_notebook_execution.py` | 5 | The notebook runs from a clean kernel in document order and produces every declared output |
| `test_repository.py` | 43 | Required files, notebook validity and portability, no unfinished markers, pinned and consistent dependencies, resolving links |

Tests run against a synthetic fixture in `tests/synthetic_data.py`, because the
real data is not distributed. That fixture exists to exercise code paths. No
number reported anywhere in this repository comes from it, the fixture
deliberately has a different shape from the real dataset so the provenance check
warns about it, and the notebook execution test runs inside a temporary
directory so no synthetic output can reach `images/` or `data/processed/`.

## Continuous Integration

Two jobs run on every push and pull request:

- __Tests__ on Python 3.11 and 3.12, including the end to end notebook execution
- __Repository integrity__: the committed notebook carries no stored outputs, no
  requirement is unpinned, and no data file is tracked

The notebook output check is the one that matters most. It is what stops a
notebook with stale outputs, or outputs generated from synthetic data, from ever
reaching the repository.

While this project lives inside a subdirectory of a larger repository, GitHub
discovers workflows only in the root `.github/workflows` directory, so CI is
driven by a wrapper there. The project also carries its own equivalent workflow
at `.github/workflows/ci.yml`, which takes effect if the project is moved into a
repository of its own.

## Corrections to the Original Analysis

Every change is documented in [docs/CHANGES.md](docs/CHANGES.md). Five changed a
reported statement, and they are listed here because a reader comparing this
repository against the source notebook needs to know about them.

1. __The multicollinearity claim contradicted its own output.__ The text stated
   that no variable was a near linear combination of the others and cited a
   threshold of 10 in the same sentence. Two variables exceeded it,
   `avg_discount_rate` at 10.53 and `cat_fashion` at 11.65, and statsmodels
   flagged a condition number of 2.93e+06 directly above. Corrected, with the
   explanation that a high factor on a one hot indicator is expected by
   construction and does not bias the coefficients.
2. __Directional accuracy was measured in sample.__ The reported 90.29 percent
   covered all 1,988 products, 1,491 of which the model was fitted on. It is now
   computed on the holdout. The recorded run never computed the holdout figure,
   so it is unknown and is not estimated here.
3. __Freight was described as flat across weight bands.__ It is flat below
   fifteen kilograms, across 107.19 to 108.56, and steps up to 124.09 above.
4. __Two causal explanations were unsupported.__ The claim that furniture's
   negative effect is caused by low sales volume was not computed anywhere. The
   notebook now computes units per product by category and the rank correlation
   against the fitted effects, so it is tested rather than asserted.
5. __Adjusted R squared printed as `NaN` on the holdout.__ Relabelled "not
   applicable" and explained.

Eleven defect fixes, six structural changes, and a list of what was deliberately
left alone and why are in [docs/CHANGES.md](docs/CHANGES.md).

## Limitations

1. __The target embeds demand while the features do not.__ Total contribution
   profit is close to units sold times per unit contribution. Units sold is
   excluded by design, so the model predicts a quantity whose largest driver is
   deliberately withheld. This caps achievable accuracy and is the main reason
   per product errors stay large.
2. __The relationship is assumed linear and additive.__ No interaction and no
   curvature. A margin effect that differs by category is not captured.
3. __Residuals are strongly non normal.__ Omnibus 619.47 at p below 0.001, skew
   1.17, kurtosis 24.97. Point estimates remain unbiased under ordinary least
   squares, but the p values and confidence intervals rest on an assumption the
   data does not meet and should be read as indicative.
4. __Two variance inflation factors exceed ten.__ Expected for one hot
   indicators, which are mutually exclusive by construction. It inflates
   standard errors on the affected terms and does not bias coefficients.
5. __Cost is imputed for 4.97 percent of products.__ Those carry a category
   median cost rather than a measured one.
6. __Unit price and cost are single values per product.__ The notebook counts
   and reports any product that violates this.
7. __The currency is undocumented.__ Amounts are presented as US dollars
   following the original analysis. That is a presentation convention, not a
   verified fact.
8. __Cancelled orders are excluded entirely.__ Their cost appears nowhere.
9. __Dataset provenance is not documented and could not be verified.__
10. __The holdout is a random split, not a chronological one.__ Purchase dates
    span 2019 to 2025, so a time based split would be a stricter test.

## Future Work

1. Add a second stage that predicts units sold from observable characteristics
   and combine it with a per unit contribution model. This addresses limitation
   one directly.
2. Refit with heteroscedasticity robust standard errors, given limitation three.
3. Model contribution profit per unit alongside the lifetime total, separating
   the pricing question from the demand question.
4. Compare against a regularised linear model and a gradient boosted tree to
   quantify how much remaining error is non linearity rather than missing
   information.
5. Evaluate on a chronological holdout to test forward generalisation.
6. Test interactions between unit gross margin and category, the most plausible
   missing term given the size of the category effects.

## Acknowledgments

The analysis in this repository was produced as group coursework for BM4088
Predictive Analytics, In Course Assessment 2, assignment group BD, business
scenario 4, Product Portfolio Profitability.

The notebook credits the following authors: Amanda Ng Shu Ping, Keane Tan,
Mutiara Cahaya Hasdinda, and Zoe Tay Yee Xuan.

The administrative identification numbers that accompanied those names in the
original notebook were removed before publication. They are institutional
identifiers for real people and serve no purpose in a public repository.

This repository is a software engineering treatment of that analysis. It
restructures the code, adds tests and automation, corrects the statements listed
under [Corrections](#corrections-to-the-original-analysis), and documents the
whole thing. It does not change the analytical intent of the original work.

The written report referenced from Section 6 of the notebook is not part of this
repository.

## License

Released under the MIT License. See [LICENSE](LICENSE).

The licence covers the code, documentation, and packaging in this repository. It
does not cover the source dataset, which is not distributed here and whose terms
are unknown. Contributors to the underlying coursework analysis are named under
[Acknowledgments](#acknowledgments).

## References

Chapman, P., Clinton, J., Kerber, R., Khabaza, T., Reinartz, T., Shearer, C.,
and Wirth, R. (2000). *CRISP-DM 1.0: Step-by-step data mining guide*. SPSS Inc.

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

The McKinney (2010) pandas reference and the Hunter (2007) matplotlib reference
were not cited in the source notebook and are not claimed here. Only works
actually relied upon in the analysis or its documentation are listed.
