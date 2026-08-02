# Reproducibility

## What Can Be Reproduced Without the Source Data

Everything except the business results.

| Item | Reproducible without the data |
|---|---|
| Install the environment | Yes |
| Run the test suite, 127 tests | Yes |
| Execute the notebook end to end | Yes, against the synthetic fixture |
| Generate every figure | Yes, against the synthetic fixture, in a temporary directory |
| Reproduce the reported metrics | No. Requires the five source files |

The test suite proves the implementation is correct, deterministic, and runnable.
It proves nothing about the business numbers, and it does not try to.

## Setup

### Option One: pip

```bash
git clone <repository-url>
cd product-portfolio-profitability

python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

pip install -r requirements.txt -r requirements-dev.txt
pip install -e .                   # optional, puts the package on the path
```

### Option Two: conda

```bash
conda env create -f environment.yml
conda activate portfolio-profitability
```

### Verify the Install

```bash
pytest
```

All 127 tests should pass in well under a minute. If they do, the environment is
correct.

## Running the Analysis

Place the five source files in `data/raw/` first. See `DATA.md`.

### Command Line

```bash
python -m portfolio_profitability.pipeline
```

Writes `data/processed/training_data.csv`, `data/processed/metrics.json`, and
seven figures into `images/`.

Options:

```bash
python -m portfolio_profitability.pipeline --help
python -m portfolio_profitability.pipeline --data-dir /path/to/csvs
python -m portfolio_profitability.pipeline --no-figures
```

### Notebook

```bash
jupyter lab notebook/MultipleLinearRegression.ipynb
```

Run all cells. The notebook resolves the repository root itself, so it works
whether the kernel starts in `notebook/` or in the repository root.

## Determinism

The analysis is deterministic. Given the same input files it produces byte
identical numeric output on every run.

| Source of variation | How it is controlled |
|---|---|
| Train and test split | `RANDOM_STATE = 42` in `config.py` |
| Cross validation folds | Same seed, `KFold(shuffle=True, random_state=42)` |
| Model fitting | Ordinary least squares has a closed form solution. No iteration, no initialisation |
| Row ordering | `groupby` sorts by key. Merges preserve left order |
| Floating point | Single threaded numpy operations on the same versions |

`tests/test_pipeline.py::test_pipeline_is_deterministic` runs the pipeline twice
and asserts the exported CSV is byte identical and the metrics JSON is character
identical.

Figures are rendered by matplotlib and are not byte reproducible across
matplotlib versions or font configurations. Their content is deterministic.

## Verifying That You Loaded the Right Data

The loader compares the shape of every table it reads against the shapes
recorded from the run that produced the published results. On a match it says
so. On any difference it prints:

```
WARNING: the loaded input does not match the recorded dataset. Any results
produced from it are NOT comparable with the figures reported in README.md and
docs/RESULTS.md.
```

That check exists so that results computed from a different or synthetic input
can never be mistaken for the published ones.

## Verified Environment

The repository was built and tested against this exact environment.

| Component | Version |
|---|---|
| Python | 3.11.15 |
| numpy | 1.26.4 |
| pandas | 2.2.3 |
| scipy | 1.14.1 |
| scikit-learn | 1.5.2 |
| statsmodels | 0.14.4 |
| matplotlib | 3.9.2 |
| pytest | 8.3.3 |
| jupyterlab | 4.2.5 |
| ipykernel | 6.29.5 |
| nbformat | 5.10.4 |
| nbclient | 0.10.0 |

Continuous integration additionally runs the suite on Python 3.12. Python 3.11
is the version verified locally.

The recorded run of the original notebook used pandas 2.2.2 and numpy 1.26.4. It
did not print its Python, scikit-learn, statsmodels, or matplotlib versions, so
those are unknown. The refactored notebook prints all of them.

## Known Dependency Constraint

__scipy must stay below 1.17 while statsmodels is pinned at 0.14.4.__

statsmodels 0.14.4 imports `_lazywhere` from `scipy._lib._util`. That private
helper was removed in scipy 1.17, so an unpinned install resolves to a
combination where importing `statsmodels.api` fails with:

```
ImportError: cannot import name '_lazywhere' from 'scipy._lib._util'
```

This is not hypothetical. It happened while building this repository, before
scipy was pinned, and it broke every statsmodels cell in the notebook. scipy is
pinned to 1.14.1 in `requirements.txt` and `environment.yml`.

If you upgrade statsmodels, check its scipy requirement before relaxing the pin.

## Continuous Integration

`.github/workflows/ci.yml` runs on every push and pull request:

1. Installs the pinned dependencies on Python 3.11 and 3.12
2. Runs the full test suite, including the end to end notebook execution
3. Asserts that the committed notebook has no stored outputs
4. Asserts that no CSV file has been committed under `data/`

Step three matters. It is what stops a notebook with stale outputs, or with
outputs generated from synthetic data, from reaching the repository.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `RawDataNotFoundError` naming five files | The source files are not in `data/raw/`. See `DATA.md`. |
| `ImportError: cannot import name '_lazywhere'` | scipy is too new for the pinned statsmodels. Reinstall from `requirements.txt`. |
| `RuntimeError: Could not locate the repository root` | Jupyter was started outside the repository. Start it from the repository root or from `notebook/`. |
| Figures do not appear inline in Jupyter | The kernel is not the environment you installed into. Select the right kernel, or run `python -m ipykernel install --user --name portfolio-profitability`. |
| The pipeline prints a provenance WARNING | The files in `data/raw/` are not the recorded dataset. Results are not comparable with `RESULTS.md`. |
