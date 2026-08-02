# Methodology

## Business Problem

An online marketplace sells 1,990 products across seven categories. The
portfolio is revenue rich and profit poor: in the recorded period it turned
10.64 million in net revenue into 2.78 million of gross profit, then handed
almost all of that back in fulfillment, ending at 144,197.53 of contribution
profit. That is a 1.36 percent contribution margin on a 26.17 percent gross
margin, because freight consumed 94.8 percent of gross profit.

The Chief Financial Officer has to decide which products to keep, cut, reprice,
or invest in. The decision is made before demand is known.

## Research Question

Can the lifetime contribution profit of a product be predicted from
characteristics observable at the point a range decision is made, accurately
enough to screen a portfolio?

## Analytical Framing

The framing carries three consequences that shape everything downstream.

__The unit of analysis is the product, not the transaction.__ Investment
decisions are made about products, so the model must be fitted at that grain.

__The target is a lifetime total, not a per unit figure.__ Total contribution
profit is what a range decision turns on.

__Units sold is excluded from the features.__ Demand is not observable when the
decision is made. Including it would let the model use information the decision
maker does not have, which would produce a flattering score and a useless tool.

The third choice has a cost that is stated plainly rather than hidden. Total
contribution profit is close to units sold multiplied by per unit contribution,
so the target embeds demand while the features do not. That sets a ceiling on
achievable accuracy and is the main reason per product dollar errors stay large
relative to the spread. It is a deliberate design decision, and it is why the
model is presented as a screening tool rather than a forecast.

## CRISP-DM Stages

### Business Understanding

Covered above. The decision maker is the Chief Financial Officer and the
decision is portfolio composition.

### Data Understanding

Five tables were profiled before any change was made: missing values by column,
exact duplicate rows, and referential integrity between order lines and orders.
Two problems drove the cleansing decisions, and both are recorded with counts in
`RESULTS.md`.

### Data Preparation

__Cleansing activity one. Remove order lines with no parent order.__ One hundred
rows carried a null order key. Without an order key a line cannot be attributed
to a customer, an order status, or a purchase date, so it cannot enter a revenue
calculation. They were removed rather than imputed because there is no
defensible basis for inventing an order identifier. This is 0.38 percent of
order lines.

__Cleansing activity two. Impute missing product cost.__ Ninety-nine products
had no cost. Cost is the denominator of every margin measure, so dropping those
products would have silently removed them from the profitability analysis and
biased the category totals. Each was filled with the median cost of its own
category. The median was chosen over the mean because cost is strongly right
skewed, which makes the mean sensitive to the few very expensive products. The
implementation falls back to the global median if an entire category has no
recorded cost, and reports how many rows that affected, so the step can never
leave a null behind without saying so.

__Date parsing.__ Timestamps are day first. Parsing them month first would
transpose day and month for every date whose day component is twelve or below,
silently and without error. Day first parsing left zero unparsed values.

__Joining.__ Order lines were joined to products and to orders with inner joins.
A line that resolves to neither cannot be costed, so retaining it would
introduce rows with undefined margin.

__Scope.__ Only delivered lines were retained. Cancelled orders never generate
recognised revenue, so including them would overstate every category total.

### Feature Engineering

| Feature | Type | Rationale |
|---|---|---|
| `unit_gross_margin` | Continuous | Dollar margin per sale. It replaces price and cost as a single term. Entering price and cost separately produced severe collinearity, since margin is a linear function of both. |
| `weight_g` | Continuous | Tests whether physical size drives profitability through fulfillment. |
| `volume_cm3` | Continuous | Dimensional bulk, the second physical driver of shipping economics. Computed as length times height times width. |
| `avg_discount_rate` | Continuous | Average promotional depth applied to the product. |
| `category` | Categorical, one hot | Category effects that remain after margin and size are held constant. One category is dropped and becomes the baseline. |

The dropped category is the first in sorted order, which for this dataset is
`auto`. Every category coefficient is read against that baseline, not against
zero and not against each other.

### Modelling

Ordinary least squares multiple linear regression, fitted with scikit-learn and
refitted with statsmodels on the identical design matrix to obtain the standard
errors, t statistics, and p values that scikit-learn does not expose. The two
fits give identical point estimates, which the test suite asserts.

Linear regression was chosen because the deliverable is an explanation as much
as a prediction. The Chief Financial Officer needs to know which lever moves
profit and by how much, and a linear coefficient answers that directly in
dollars. A tree ensemble would likely predict better and would not answer the
question the decision requires.

Hyperparameters: none. Ordinary least squares has a closed form solution and no
tuning surface. The only configuration is the train and test split, fixed at 25
percent holdout with seed 42.

### Evaluation

| Metric | What it answers |
|---|---|
| R squared | How much of the variation in contribution profit the model explains |
| Adjusted R squared | The same, penalised for the number of predictors. Training set only, because a holdout set consumes no degrees of freedom |
| RMSE | Typical error in dollars, penalising large misses |
| MAE | Typical error in dollars, treating all misses equally |
| Five fold cross validated R squared | Whether the result depends on one favourable split |
| Directional accuracy | How often the profit or loss call is right, which is what a screening decision needs |

Directional accuracy is reported on the holdout set. Computing it across the
full sample mixes in rows the model was fitted on and produces an optimistically
biased figure. See `CHANGES.md`, correction two.

Cross validation runs over the full product set. It is a stability check on the
whole sample. It is not an independent confirmation of the holdout metrics,
because the holdout rows take part in it.

### Diagnostics

- Predicted against actual on the holdout set, with a perfect fit reference line
- Residuals against fitted values, to expose heteroscedasticity
- Residual distribution, to expose skew
- Actual and predicted across the holdout set ordered by actual, to show where
  the model compresses the tails
- Variance inflation factors, with any variable above ten flagged rather than
  assumed absent
- The statsmodels Omnibus, Jarque-Bera, skew, kurtosis, and condition number
  diagnostics

### Deployment

Out of scope for this assessment. The pipeline writes
`data/processed/training_data.csv` and `data/processed/metrics.json`, which are
the handover artefacts.

## Reproducibility Controls

| Control | Implementation |
|---|---|
| Fixed seed | `RANDOM_STATE = 42` in `config.py`, used by the split and by cross validation |
| No other randomness | Ordinary least squares is deterministic. No sampling, no shuffling outside the seeded split |
| Pinned dependencies | Exact versions in `requirements.txt` and `environment.yml` |
| Path independence | Every path resolves from the repository root, so the working directory does not matter |
| Provenance check | The loader compares input shapes against the recorded dataset and warns on any difference |
| Determinism test | The suite runs the pipeline twice and asserts byte identical output |

## Threats to Validity

Recorded in full in Section 7 of the notebook and summarised in `README.md`. The
three that most limit what the results support:

1. The target embeds demand while the features do not, which caps achievable
   accuracy by design.
2. Residuals are strongly non normal, so the p values and confidence intervals
   are indicative rather than exact.
3. The holdout is a random split. Purchase dates span 2019 to 2025, so a
   chronological split would be a stricter test of forward generalisation.
