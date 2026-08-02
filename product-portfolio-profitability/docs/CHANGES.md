# Changes Made to the Source Notebook

Every change is listed. Changes are grouped by whether they alter a reported
number, because that distinction is what a reviewer needs first.

The analytical intent of the original work is preserved throughout. No analysis
was removed, and no conclusion was changed except where the original text
contradicted its own output.

## Group A: Corrections That Change a Reported Statement

### A1. The Multicollinearity Claim Contradicted Its Own Output

__Original.__ The markdown above the diagnostics cell stated that variance
inflation factors "confirm that no explanatory variable is a near linear
combination of the others", and cited a threshold of 10 from Hair et al. (2019)
in the same sentence.

__Problem.__ The cell's own output showed `avg_discount_rate` at 10.53 and
`cat_fashion` at 11.65, both above the threshold the text had just cited.
statsmodels independently flagged a condition number of 2.93e+06 in the
regression summary printed immediately above.

__Change.__ The claim is replaced with the actual values and their
interpretation. The notebook now flags any variable above the threshold at run
time rather than asserting in advance that none exist. The interpretation added
is that a high factor on a one hot indicator is expected, because indicators
from one categorical variable are mutually exclusive and therefore partly
predictable from each other by construction, which inflates standard errors on
the affected terms without biasing the coefficients.

### A2. Directional Accuracy Was Measured on Data the Model Was Fitted On

__Original.__ `all_pred = model.predict(X)` followed by a comparison against all
1,988 products, reported as "Directional accuracy: 90.29%".

__Problem.__ 1,491 of those 1,988 products were in the training set. The figure
therefore measures in sample performance and is optimistically biased. The
interpretation in Section 6.2 read it as evidence about unseen products.

__Change.__ Directional accuracy is now computed on the holdout set as the
headline figure, with the full sample figure retained and labelled. The
supporting claim in Section 6.2 was removed, because the holdout figure was
never computed in the recorded run and therefore is not known. It is not
estimated. See `RESULTS.md`.

### A3. Freight Was Described as Flat Across Weight Bands

__Original.__ "the average freight is flat across weight bands".

__Problem.__ The table printed directly below showed 107.19, 108.02, 107.56, and
108.56 for the four bands below fifteen kilograms, then 124.09 above it. The top
band is 15.2 percent above the lowest.

__Change.__ The statement now reads that freight is effectively a fixed charge
per item below fifteen kilograms and steps up above it. The substantive
conclusion, that fulfillment cost does not scale smoothly with size, is
unaffected and is still supported by correlations of 0.070, 0.022, and -0.003.

### A4. Unsupported Causal Explanations

__Original.__ "a furniture product returns roughly 1,788 dollars less lifetime
contribution than an equivalent auto product, because furniture sells in low
volume. Electronics carries a positive effect for the opposite reason."

__Problem.__ Nothing in the notebook computed units per product by category, so
neither causal claim was supported by anything the reader could check.

__Change.__ The notebook now computes units per product by category and the rank
correlation between that and the fitted category effect, so the explanation is
tested rather than asserted. The markdown states the coefficient magnitudes as
fact and defers the explanation to the computed result.

### A5. Adjusted R Squared Reported as NaN on the Holdout Set

__Original.__ The metrics table printed `NaN` in the holdout column.

__Change.__ Labelled "not applicable" and documented. Adjusted R squared
corrects for degrees of freedom consumed while fitting, and a holdout set
consumes none, so the quantity is undefined there rather than merely
uncomputed. No number changes.

## Group B: Defect Fixes That Do Not Change Any Recorded Number

Each of these fixes a latent failure that did not trigger on the recorded
dataset. The recorded results are unaffected, which is stated for each one.

### B1. Weight Bands Could Silently Drop Rows

`pd.cut(weight, [0, 500, 1000, 5000, 15000, 60000])` assigns a null band to any
product at exactly zero grams or above sixty thousand grams, and those rows then
disappear from the table without changing the reported total. The outer edges
are now unbounded and the function raises if any row falls outside the banding,
with an assertion that band counts reconcile to the input rows.

Recorded run unaffected: the five bands summed to 24,231, which equals the
delivered line count, so no row was dropped.

### B2. Cost Imputation Could Leave Nulls Behind

`groupby(category).cost.transform('median')` returns null for a category with no
recorded cost at all, and `fillna` then leaves those rows null, which propagates
into every margin measure. A global median fallback was added, with the affected
row count reported.

Recorded run unaffected: all seven categories had at least one non null cost,
and the fallback count was zero.

### B3. Hard Coded Axis Limits

`lims = [-17000, 23000]` was fixed to the observed data range. Any point outside
it would be drawn off the axes without warning. Limits are now derived from the
data with a five percent margin. Covered by a regression test.

### B4. Blanket Warning Suppression

`warnings.filterwarnings('ignore')` hid every warning from every library,
including genuine correctness warnings from pandas about behaviour that is
changing. It was removed entirely. The test suite escalates `FutureWarning` to
an error, so the project fails its build rather than silently relying on a
deprecated interface.

### B5. `display` Used Without Import

`display` is injected into the namespace by IPython at run time and does not
exist when the notebook is converted to a script or imported as a module. It is
now imported explicitly from `IPython.display`.

### B6. Unverified Single Price Assumption

The product level aggregation takes the first observed price and cost per
product, which is exact only if a product carries one price. That was assumed
rather than checked. The notebook now counts products with more than one
observed price and reports them.

Recorded run unaffected: this is a new diagnostic, not a change to the
aggregation.

### B7. Output Written to the Working Directory

`training_data.csv` was written to whatever directory the kernel started in.
Output now goes to `data/processed/` with the directory created if needed, so
the export lands in the same place regardless of how the notebook was launched.

### B8. Colab Specific Data Loading

The loader searched five hard coded paths including `/content/` and
`/content/data/`, then fell back to `google.colab.files.upload()`. That makes the
notebook unrunnable outside Colab without an unhandled import error path, and
makes it impossible to tell which file was actually loaded. It is replaced with
a single documented location, `data/raw/`, resolved from the repository root,
and an explicit error naming every missing file.

### B9. No Check That the Right Data Was Loaded

Nothing verified that the loaded files were the dataset the published results
came from. A provenance check was added that compares the shape of every loaded
table against the recorded shapes and prints a clear warning on any difference.

### B10. Dependency Combination That Fails at Import

Discovered while building this repository. `statsmodels==0.14.4` imports
`scipy._lib._util._lazywhere`, which was removed in scipy 1.17. An unpinned
install therefore resolves to a combination where every statsmodels cell fails
with an `ImportError`. scipy is now pinned to 1.14.1 and the constraint is
documented in `requirements.txt`, `environment.yml`, and `REPRODUCIBILITY.md`.

### B11. Missing Cell Identifiers

The notebook declared `nbformat_minor` 5, which requires an `id` on every cell,
but the cells had none. `nbformat.validate` raises `MissingIDFieldWarning` on
such a file. Stable identifiers were added.

## Group C: Structural and Documentation Changes

### C1. Logic Extracted Into a Tested Package

Every analytical operation moved into `src/portfolio_profitability/`, split into
`config`, `data_loading`, `cleaning`, `features`, `modeling`, `evaluation`,
`plots`, and `pipeline`. The notebook calls that package, so the code a reader
sees is the code the test suite exercises. 127 tests cover it.

### C2. Command Line Pipeline

`python -m portfolio_profitability.pipeline` reproduces the whole analysis
without opening a notebook, and writes `metrics.json` alongside the training
data so results are machine readable.

### C3. Outputs Cleared From the Committed Notebook

Every code cell output was cleared. The code changed, so retained outputs would
no longer correspond to the code beside them, and a reader without the source
files could not regenerate them to check. The recorded results are transcribed
with their provenance in `RESULTS.md`, and the one figure that survives as a
rendered image is committed to `images/`.

### C4. Additional Figures

The original produced one two panel diagnostic. The pipeline now produces seven
figures: correlation heatmap, holdout diagnostics, residual distribution, ranked
actual against predicted, coefficient effects, category contribution profit, and
freight by weight band. All share one house style and were checked for colour
vision deficiency separation rather than chosen by eye.

### C5. Limitations, Future Work, and References

Sections 7, 8, and 9 were added. The original notebook cited Hair et al. (2019)
in passing without a reference entry. That citation is now complete, and the
scikit-learn, statsmodels, and CRISP-DM references were added. Every reference
corresponds to a real publication.

### C6. Variable Names

`oi` became `order_items_raw`, `fact` became `order_item_facts`, `export` became
`training_export`, `cv` became `cross_validation`, `lims` became derived axis
limits, `bands` became `weight_bands`, and `n, p` became explicit observation
and predictor counts.

### C7. Student Identification Numbers Removed

The original header carried four administrative numbers alongside the author
names. Those are institutional identifiers for real people and serve no purpose
in a public repository, so they were removed. Author names are retained, because
attribution for the analysis is owed to the people who produced it.

### C8. Currency Assumption Made Explicit

The original presented every amount with a dollar sign and labelled figure axes
"USD". Nothing in the source data identifies a currency. The convention is
preserved so the figures stay comparable, and it is now recorded as an
assumption in `DATA.md` rather than presented as a fact.

## What Was Deliberately Not Changed

| Item | Reason |
|---|---|
| Cross validation over the full product set | This is a valid standalone stability check. Restricting it to the training set would change a reported number for no gain. The wording was clarified so it is not read as validating the holdout. |
| `customers` and `sellers` loaded but unused in the model | They serve the data quality profile in Section 3, which is part of the assessed work. |
| Median rather than mean cost imputation | The stated justification, that cost is right skewed, is sound. |
| The model specification | Changing the features would change every reported result and would not be a correction. |
| The 75/25 split and seed 42 | Changing either would change every reported result. |
| Ordinary least squares as the algorithm | The deliverable is an explanation in dollars. Alternatives are recorded under future work instead. |
