# Figures

## Committed Figure

### holdout-diagnostics-recorded-run.png

![Predicted versus actual and residuals versus fitted values, holdout set](holdout-diagnostics-recorded-run.png)

__This is the only figure in this repository produced from the real dataset.__

It was extracted from the stored output of the recorded execution of the source
notebook, so it is genuine output rather than a reconstruction. It is committed
because it cannot be regenerated without the source files, which the repository
does not contain.

Left panel: predicted against actual contribution profit on the 497 product
holdout set, with a dashed perfect fit reference. Predictions track actual
values through the centre of the portfolio and compress at both tails.

Right panel: residuals against fitted values. Spread widens as the fitted value
grows, which is the heteroscedasticity quantified in `../docs/RESULTS.md`.

## Figures Generated at Run Time

The remaining figures are produced when the pipeline runs against the source
files. They are not committed, because a figure derived from data the repository
does not contain could not be checked by a reader.

Generate them with:

```bash
python -m portfolio_profitability.pipeline
```

or by running `../notebook/MultipleLinearRegression.ipynb`.

| File | Content |
|---|---|
| `correlation-heatmap.png` | Pearson correlation across the product level features and the target, on a fixed minus one to plus one scale |
| `holdout-diagnostics.png` | Predicted against actual, and residuals against fitted values, with axis limits derived from the data |
| `residual-distribution.png` | Distribution of holdout residuals against a zero reference |
| `actual-versus-predicted-ranked.png` | Actual and predicted across the holdout, ordered by actual, showing where the model compresses the tails |
| `effect-sizes.png` | Comparable effect sizes in dollars: continuous variables scaled by their own standard deviation, and category effects relative to the baseline |
| `category-contribution-profit.png` | Total contribution profit by product category |
| `freight-by-weight-band.png` | Average freight per item by weight band against the portfolio mean |

## A Warning About Synthetic Output

The test suite executes the notebook and the pipeline against a synthetic
fixture, which fabricates data solely to exercise code paths. Those runs happen
inside temporary directories and cannot write here.

__Never commit a figure produced from the synthetic fixture.__ It would look
exactly like a real result and would be one of the few ways this repository
could mislead a reader. If you are unsure where a figure came from, delete it
and regenerate it from the source files.

## Design Notes

All figures share one house style, implemented in
`../src/portfolio_profitability/plots.py`.

- Light chart surface, hairline recessive gridlines and axes, thin marks
- One blue for a single series. Bar length already encodes magnitude, so hue is
  not spent restating it
- Blue against red for polarity, with a neutral grey midpoint on the correlation
  scale, because a midpoint must read as nothing rather than as a hue
- The blue and red pair was checked rather than eyeballed. It measures a normal
  vision difference of 32.3 and a worst case protanopia difference of 21.6 on
  the OKLab scale, both above the accepted floors, and both clear three to one
  contrast against the surface
- Every figure that encodes sign by colour also carries a direct value label, so
  meaning is never colour alone
- The correlation scale is fixed to the full minus one to plus one range, so a
  weak relationship can never be exaggerated by rescaling to its own extent
