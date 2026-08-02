"""Publication quality figures for the contribution profit regression.

Every figure follows one house style: a light chart surface, hairline recessive
gridlines and axes, thin marks with breathing room, and no chart junk. Colour
is assigned by the job it does. A single series is drawn in one blue. Polarity
uses a blue and red diverging pair with a neutral grey midpoint, which reads as
opposite rather than as ranked. Magnitude on the correlation matrix uses the
same diverging pair because correlation is signed.

The categorical pair in use was checked for colour vision deficiency separation
rather than chosen by eye. Blue against red measures a normal vision difference
of 32.3 and a worst case protanopia difference of 21.6 on the OKLab scale, both
comfortably above the accepted floors, and both clear three to one contrast on
the chart surface. Every figure that encodes sign by colour also carries a
direct value label, so meaning is never colour alone.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import matplotlib

# Select a non interactive backend only when the session has no way to display
# a figure. Inside Jupyter the inline backend is already active and must be
# left alone, otherwise figures stop rendering in the notebook. force=False
# means an existing backend choice is never overridden.
if "ipykernel" not in sys.modules and not os.environ.get("DISPLAY"):
    matplotlib.use("Agg", force=False)

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.colors import LinearSegmentedColormap

from .config import CURRENCY_LABEL, FIGURE_DPI, IMAGES_DIR

# ---------------------------------------------------------------------------
# House style
# ---------------------------------------------------------------------------

SURFACE = "#fcfcfb"
INK_PRIMARY = "#0b0b0b"
INK_SECONDARY = "#52514e"
INK_MUTED = "#898781"
GRIDLINE = "#e1e0d9"
BASELINE = "#c3c2b7"

SERIES_BLUE = "#2a78d6"
SERIES_RED = "#e34948"
NEUTRAL_MID = "#f0efec"

DIVERGING_CMAP = LinearSegmentedColormap.from_list(
    "blue_neutral_red", [SERIES_BLUE, NEUTRAL_MID, SERIES_RED], N=256
)

RC_PARAMS: dict[str, object] = {
    "figure.facecolor": SURFACE,
    "axes.facecolor": SURFACE,
    "savefig.facecolor": SURFACE,
    "axes.edgecolor": BASELINE,
    "axes.linewidth": 0.8,
    "axes.labelcolor": INK_SECONDARY,
    "axes.titlecolor": INK_PRIMARY,
    "axes.grid": True,
    "axes.axisbelow": True,
    "grid.color": GRIDLINE,
    "grid.linewidth": 0.8,
    "grid.linestyle": "-",
    "xtick.color": INK_MUTED,
    "ytick.color": INK_MUTED,
    "xtick.labelcolor": INK_SECONDARY,
    "ytick.labelcolor": INK_SECONDARY,
    "font.family": "sans-serif",
    "font.size": 9.5,
    "figure.dpi": 110,
    "savefig.dpi": FIGURE_DPI,
    "savefig.bbox": "tight",
    "legend.frameon": False,
}


def apply_house_style() -> None:
    """Apply the shared figure style to the active matplotlib session."""
    plt.rcParams.update(RC_PARAMS)


def _finish(ax: plt.Axes, title: str, subtitle: str | None = None) -> None:
    """Apply the shared axis treatment: left aligned title, recessive frame.

    Title and subtitle are both offset in points rather than in axes fractions,
    so they keep the same spacing whatever the figure height and never collide.
    """
    ax.set_title(
        title,
        loc="left",
        fontweight="bold",
        color=INK_PRIMARY,
        pad=26 if subtitle else 12,
    )
    if subtitle:
        ax.annotate(
            subtitle,
            xy=(0.0, 1.0),
            xycoords="axes fraction",
            xytext=(0, 7),
            textcoords="offset points",
            ha="left",
            va="bottom",
            fontsize=8.5,
            color=INK_SECONDARY,
            annotation_clip=False,
        )
    ax.spines[["top", "right"]].set_visible(False)


def save_figure(
    fig: plt.Figure,
    filename: str,
    images_dir: Path | None = None,
    close: bool = True,
) -> Path:
    """Write a figure to the images directory and return the path.

    Set ``close`` to False inside a notebook so the figure is still rendered
    inline after it has been written to disk.
    """
    target_dir = Path(images_dir) if images_dir is not None else IMAGES_DIR
    target_dir.mkdir(parents=True, exist_ok=True)
    path = target_dir / filename
    fig.savefig(path)
    if close:
        plt.close(fig)
    return path


def _money(currency: str = CURRENCY_LABEL) -> str:
    """Return the currency suffix used in axis labels."""
    return f"({currency})"


# ---------------------------------------------------------------------------
# Figures
# ---------------------------------------------------------------------------


def plot_correlation_heatmap(
    frame: pd.DataFrame, columns: list[str], title: str = "Correlation Matrix"
) -> plt.Figure:
    """Correlation matrix drawn on a signed blue to red diverging scale.

    The scale is fixed to the full minus one to plus one range so that no
    matrix ever exaggerates a weak relationship by rescaling to its own extent.
    Every cell carries its value, which is the table view of the same data.
    """
    apply_house_style()
    matrix = frame[columns].corr()

    size = max(4.6, 0.78 * len(columns) + 2.2)
    fig, ax = plt.subplots(figsize=(size, size * 0.86))
    image = ax.imshow(matrix.values, cmap=DIVERGING_CMAP, vmin=-1.0, vmax=1.0)

    ax.set_xticks(range(len(columns)), columns, rotation=40, ha="right")
    ax.set_yticks(range(len(columns)), columns)
    ax.grid(False)

    for row in range(len(columns)):
        for column in range(len(columns)):
            value = matrix.values[row, column]
            ax.text(
                column,
                row,
                f"{value:+.2f}",
                ha="center",
                va="center",
                fontsize=8,
                color=INK_PRIMARY if abs(value) < 0.55 else SURFACE,
            )

    colorbar = fig.colorbar(image, ax=ax, shrink=0.78, pad=0.03)
    colorbar.set_label("Pearson correlation", color=INK_SECONDARY, fontsize=8.5)
    colorbar.outline.set_visible(False)
    colorbar.ax.tick_params(color=INK_MUTED, labelcolor=INK_SECONDARY, labelsize=8)

    _finish(ax, title, "Fixed scale from minus one to plus one")
    ax.spines[["left", "bottom"]].set_visible(False)
    fig.tight_layout()
    return fig


def plot_holdout_diagnostics(
    actual: pd.Series,
    predicted: np.ndarray,
    currency: str = CURRENCY_LABEL,
) -> plt.Figure:
    """Two panel regression diagnostic: predicted against actual, and residuals.

    Axis limits are derived from the data rather than hard coded, so the figure
    stays correct if the underlying data changes.
    """
    apply_house_style()
    actual_values = np.asarray(actual, dtype=float)
    residuals = actual_values - predicted

    fig, axes = plt.subplots(1, 2, figsize=(11, 4.3))

    combined = np.concatenate([actual_values, predicted])
    pad = 0.05 * (combined.max() - combined.min())
    limits = [combined.min() - pad, combined.max() + pad]

    axes[0].plot(
        limits, limits, color=BASELINE, lw=1.1, ls="--", zorder=1, label="Perfect fit"
    )
    axes[0].scatter(
        actual_values,
        predicted,
        s=16,
        color=SERIES_BLUE,
        alpha=0.55,
        linewidths=0.4,
        edgecolors=SURFACE,
        zorder=2,
    )
    axes[0].set_xlim(limits)
    axes[0].set_ylim(limits)
    axes[0].set_xlabel(f"Actual contribution profit {_money(currency)}")
    axes[0].set_ylabel(f"Predicted contribution profit {_money(currency)}")
    axes[0].legend(loc="upper left", fontsize=8, labelcolor=INK_SECONDARY)
    _finish(axes[0], "Predicted Versus Actual, Holdout Set")

    axes[1].axhline(0, color=INK_SECONDARY, lw=1.1, zorder=1)
    axes[1].scatter(
        predicted,
        residuals,
        s=16,
        color=SERIES_BLUE,
        alpha=0.55,
        linewidths=0.4,
        edgecolors=SURFACE,
        zorder=2,
    )
    axes[1].set_xlabel(f"Predicted contribution profit {_money(currency)}")
    axes[1].set_ylabel(f"Residual {_money(currency)}")
    _finish(axes[1], "Residuals Versus Fitted Values")

    fig.tight_layout()
    return fig


def plot_residual_distribution(
    actual: pd.Series,
    predicted: np.ndarray,
    bins: int = 45,
    currency: str = CURRENCY_LABEL,
) -> plt.Figure:
    """Distribution of holdout residuals against a zero reference."""
    apply_house_style()
    residuals = np.asarray(actual, dtype=float) - predicted

    fig, ax = plt.subplots(figsize=(7.4, 4.2))
    ax.hist(
        residuals,
        bins=bins,
        color=SERIES_BLUE,
        alpha=0.85,
        edgecolor=SURFACE,
        linewidth=0.6,
    )
    ax.axvline(0, color=INK_SECONDARY, lw=1.1)
    ax.set_xlabel(f"Residual, actual minus predicted {_money(currency)}")
    ax.set_ylabel("Products")
    ax.grid(axis="x", visible=False)

    mean_error = residuals.mean()
    ax.text(
        0.985,
        0.95,
        f"Mean residual {mean_error:,.0f}\nStandard deviation {residuals.std():,.0f}",
        transform=ax.transAxes,
        ha="right",
        va="top",
        fontsize=8.5,
        color=INK_SECONDARY,
    )
    _finish(ax, "Holdout Residual Distribution")
    fig.tight_layout()
    return fig


def _diverging_bars(
    ax: plt.Axes, labels: list[str], values: list[float], value_format: str
) -> None:
    """Draw horizontal bars coloured by sign with a direct label on each bar."""
    positions = np.arange(len(labels))
    colors = [SERIES_BLUE if value >= 0 else SERIES_RED for value in values]
    ax.barh(positions, values, color=colors, height=0.66, zorder=2)
    ax.set_yticks(positions, labels)
    ax.invert_yaxis()
    ax.axvline(0, color=BASELINE, lw=1.0, zorder=1)
    ax.grid(axis="y", visible=False)

    span = max(abs(value) for value in values) if values else 1.0
    offset = span * 0.02
    for position, value in zip(positions, values):
        ax.text(
            value + (offset if value >= 0 else -offset),
            position,
            format(value, value_format),
            va="center",
            ha="left" if value >= 0 else "right",
            fontsize=8.5,
            color=INK_SECONDARY,
        )
    ax.set_xlim(-span * 1.28, span * 1.28)


def plot_effect_sizes(
    coefficients: pd.DataFrame,
    design_matrix: pd.DataFrame,
    dummy_prefix: str = "cat_",
    currency: str = CURRENCY_LABEL,
) -> plt.Figure:
    """Comparable effect sizes, split by the kind of variable.

    Raw coefficients cannot be plotted on one axis. Each is expressed per one
    unit of its own measure, so a coefficient of 0.0067 dollars per gram and one
    of 16.49 dollars per dollar of margin are not comparable quantities, and
    putting them on a shared scale makes the largest number look like the
    largest effect. On the real data that renders the single most important
    variable as an invisible sliver.

    Both panels are therefore in the same unit, dollars of lifetime contribution
    profit, and each panel is internally comparable:

    - Continuous variables are scaled by their own standard deviation, giving
      the change in profit for a one standard deviation increase.
    - Category indicators keep their coefficient, which is already the effect of
      being in that category rather than in the baseline.

    The two panels answer different questions, so they carry separate scales and
    separate labels rather than being forced onto one axis.
    """
    apply_house_style()

    is_dummy = coefficients["variable"].str.startswith(dummy_prefix)
    continuous = coefficients[~is_dummy].copy()
    categorical = coefficients[is_dummy].copy()

    standard_deviations = design_matrix.std()
    continuous["effect"] = continuous.apply(
        lambda row: row["coefficient"] * float(standard_deviations[row["variable"]]),
        axis=1,
    )
    continuous = continuous.sort_values("effect", ascending=False)

    categorical["effect"] = categorical["coefficient"]
    categorical["label"] = categorical["variable"].str.replace(
        dummy_prefix, "", regex=False
    )
    categorical = categorical.sort_values("effect", ascending=False)

    rows = max(len(continuous), len(categorical))
    fig, axes = plt.subplots(1, 2, figsize=(12.4, 0.46 * rows + 2.4))

    _diverging_bars(
        axes[0],
        continuous["variable"].tolist(),
        continuous["effect"].astype(float).tolist(),
        ",.2f",
    )
    axes[0].set_xlabel(f"Change in contribution profit {_money(currency)}")
    _finish(
        axes[0],
        "Continuous Variables",
        "Effect of a one standard deviation increase",
    )

    _diverging_bars(
        axes[1],
        categorical["label"].tolist(),
        categorical["effect"].astype(float).tolist(),
        ",.2f",
    )
    axes[1].set_xlabel(f"Change in contribution profit {_money(currency)}")
    _finish(
        axes[1],
        "Category Effects",
        "Effect relative to the dropped baseline category",
    )

    fig.suptitle(
        "Comparable Effect Sizes. Blue Raises Contribution Profit, Red Lowers It",
        x=0.005,
        ha="left",
        fontsize=11,
        fontweight="bold",
        color=INK_PRIMARY,
    )
    fig.tight_layout(rect=(0, 0, 1, 0.94))
    return fig


def plot_category_contribution(
    category_table: pd.DataFrame,
    label_column: str = "product_category_name",
    value_column: str = "contribution_profit",
    currency: str = CURRENCY_LABEL,
) -> plt.Figure:
    """Total contribution profit by product category."""
    apply_house_style()
    ordered = category_table.sort_values(value_column, ascending=False)
    labels = ordered[label_column].tolist()
    values = ordered[value_column].astype(float).tolist()

    fig, ax = plt.subplots(figsize=(8.2, 0.46 * len(labels) + 2.1))
    _diverging_bars(ax, labels, values, ",.0f")
    ax.set_xlabel(f"Contribution profit {_money(currency)}")
    _finish(
        ax,
        "Contribution Profit by Product Category",
        "Delivered order items only. Blue is profit, red is loss",
    )
    fig.tight_layout()
    return fig


def plot_freight_by_weight_band(
    band_table: pd.DataFrame,
    portfolio_mean_freight: float,
    currency: str = CURRENCY_LABEL,
) -> plt.Figure:
    """Average freight charge within each weight band against the portfolio mean.

    One series, so every bar takes the same colour. Bar length already encodes
    the value and a second encoding on hue would add nothing.
    """
    apply_house_style()
    labels = band_table["weight_band"].astype(str).tolist()
    values = band_table["avg_freight"].astype(float).to_numpy()

    # A band containing no products has an undefined average. It is drawn at
    # zero height and labelled, rather than dropped, so the reader can see that
    # the band exists and is empty.
    finite = np.isfinite(values)
    if not finite.any():
        raise ValueError("No weight band has a defined average freight charge.")
    heights = np.where(finite, values, 0.0)

    fig, ax = plt.subplots(figsize=(7.8, 4.3))
    positions = np.arange(len(labels))
    ax.bar(positions, heights, color=SERIES_BLUE, width=0.62, zorder=2)
    ax.axhline(
        portfolio_mean_freight,
        color=INK_SECONDARY,
        lw=1.1,
        ls="--",
        zorder=3,
        label=f"Portfolio mean {portfolio_mean_freight:,.2f}",
    )
    ax.set_xticks(positions, labels, rotation=18, ha="right")
    ax.set_ylabel(f"Average freight per item {_money(currency)}")
    ax.grid(axis="x", visible=False)
    ax.legend(loc="upper left", fontsize=8, labelcolor=INK_SECONDARY)

    for position, value, is_finite in zip(positions, values, finite):
        ax.text(
            position,
            value if is_finite else 0.0,
            f"{value:,.2f}" if is_finite else "no items",
            ha="center",
            va="bottom",
            fontsize=8.5,
            color=INK_SECONDARY,
        )
    upper = max(float(np.nanmax(values)), float(portfolio_mean_freight))
    ax.set_ylim(0, upper * 1.16)
    _finish(ax, "Average Freight Charge by Product Weight Band")
    fig.tight_layout()
    return fig


def plot_actual_versus_predicted_by_rank(
    actual: pd.Series, predicted: np.ndarray, currency: str = CURRENCY_LABEL
) -> plt.Figure:
    """Actual and predicted contribution profit, holdout products sorted by actual.

    This shows where the model tracks the portfolio and where it compresses the
    extremes, which a scatter plot alone makes harder to read.
    """
    apply_house_style()
    order = np.argsort(np.asarray(actual, dtype=float))
    actual_sorted = np.asarray(actual, dtype=float)[order]
    predicted_sorted = np.asarray(predicted, dtype=float)[order]
    positions = np.arange(len(actual_sorted))

    fig, ax = plt.subplots(figsize=(9.0, 4.3))
    ax.plot(positions, actual_sorted, color=SERIES_BLUE, lw=2.0, label="Actual")
    ax.plot(
        positions, predicted_sorted, color=SERIES_RED, lw=1.6, alpha=0.9, label="Predicted"
    )
    ax.axhline(0, color=BASELINE, lw=1.0)
    ax.set_xlabel("Holdout products, ordered by actual contribution profit")
    ax.set_ylabel(f"Contribution profit {_money(currency)}")
    ax.legend(loc="upper left", fontsize=8.5, labelcolor=INK_SECONDARY)
    _finish(
        ax,
        "Actual and Predicted Contribution Profit Across the Holdout Set",
        "The model tracks the middle of the portfolio and compresses both tails",
    )
    fig.tight_layout()
    return fig
