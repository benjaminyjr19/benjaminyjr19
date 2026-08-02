"""Tests that every figure builds and writes a readable PNG file."""

from __future__ import annotations

import numpy as np
import pytest

matplotlib = pytest.importorskip("matplotlib")

from portfolio_profitability import features, modeling, plots  # noqa: E402

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


@pytest.fixture(scope="module")
def fitted(design):
    matrix, target = design
    train_x, test_x, train_y, test_y = modeling.split_data(matrix, target)
    model = modeling.fit_linear_regression(train_x, train_y)
    return {
        "matrix": matrix,
        "target": target,
        "test_y": test_y,
        "predicted_test": model.predict(test_x),
        "coefficients": modeling.coefficient_table(model, matrix.columns),
        "intercept": float(model.intercept_),
    }


def _assert_saved_png(path):
    assert path.exists()
    assert path.stat().st_size > 5_000
    with open(path, "rb") as handle:
        assert handle.read(8) == PNG_MAGIC


def test_correlation_heatmap(product_level, tmp_path):
    columns = ["unit_gross_margin", "weight_g", "volume_cm3", "contribution_profit"]
    figure = plots.plot_correlation_heatmap(product_level, columns)
    _assert_saved_png(plots.save_figure(figure, "heatmap.png", tmp_path))


def test_holdout_diagnostics(fitted, tmp_path):
    figure = plots.plot_holdout_diagnostics(fitted["test_y"], fitted["predicted_test"])
    _assert_saved_png(plots.save_figure(figure, "diagnostics.png", tmp_path))


def test_residual_distribution(fitted, tmp_path):
    figure = plots.plot_residual_distribution(
        fitted["test_y"], fitted["predicted_test"]
    )
    _assert_saved_png(plots.save_figure(figure, "residuals.png", tmp_path))


def test_ranked_actual_versus_predicted(fitted, tmp_path):
    figure = plots.plot_actual_versus_predicted_by_rank(
        fitted["test_y"], fitted["predicted_test"]
    )
    _assert_saved_png(plots.save_figure(figure, "ranked.png", tmp_path))


def test_effect_sizes(fitted, tmp_path):
    figure = plots.plot_effect_sizes(fitted["coefficients"], fitted["matrix"])
    _assert_saved_png(plots.save_figure(figure, "effects.png", tmp_path))


def test_effect_sizes_keeps_incomparable_units_on_separate_scales(fitted):
    """Continuous and category effects must not share one axis.

    The two panels answer different questions and are measured differently, so
    forcing them onto a shared scale would make the largest raw number look like
    the largest effect.
    """
    figure = plots.plot_effect_sizes(fitted["coefficients"], fitted["matrix"])
    assert len(figure.axes) == 2
    assert figure.axes[0].get_xlim() != figure.axes[1].get_xlim()
    matplotlib.pyplot.close(figure)


def test_continuous_effects_are_scaled_by_their_standard_deviation(fitted):
    """A one standard deviation effect equals the coefficient times that spread."""
    figure = plots.plot_effect_sizes(fitted["coefficients"], fitted["matrix"])
    drawn = {
        label.get_text(): patch.get_width()
        for label, patch in zip(
            figure.axes[0].get_yticklabels(), figure.axes[0].patches
        )
    }
    coefficients = dict(
        zip(fitted["coefficients"]["variable"], fitted["coefficients"]["coefficient"])
    )
    spreads = fitted["matrix"].std()
    for variable, width in drawn.items():
        assert width == pytest.approx(
            coefficients[variable] * float(spreads[variable]), rel=1e-6
        )
    matplotlib.pyplot.close(figure)


def test_category_contribution(delivered, tmp_path):
    figure = plots.plot_category_contribution(features.category_summary(delivered))
    _assert_saved_png(plots.save_figure(figure, "category.png", tmp_path))


def test_freight_by_weight_band(delivered, tmp_path):
    figure = plots.plot_freight_by_weight_band(
        features.freight_by_weight_band(delivered),
        float(delivered["freight_value"].mean()),
    )
    _assert_saved_png(plots.save_figure(figure, "freight.png", tmp_path))


def test_save_figure_creates_a_missing_directory(product_level, tmp_path):
    target = tmp_path / "nested" / "deeper"
    figure = plots.plot_correlation_heatmap(product_level, ["weight_g", "volume_cm3"])
    path = plots.save_figure(figure, "nested.png", target)
    assert path.parent.is_dir()
    _assert_saved_png(path)


def test_diverging_colormap_is_symmetric_about_a_neutral_midpoint():
    midpoint = plots.DIVERGING_CMAP(0.5)
    red, green, blue = midpoint[0], midpoint[1], midpoint[2]
    # The midpoint must read as nothing rather than as a hue, so the three
    # channels sit close together and the value is light.
    assert max(red, green, blue) - min(red, green, blue) < 0.05
    assert min(red, green, blue) > 0.8


def test_diagnostics_axis_limits_follow_the_data():
    # The source notebook hard coded the axis limits. They are now derived, so
    # a point far outside the original range must still be inside the axes.
    actual = np.array([-50_000.0, 0.0, 50_000.0])
    predicted = np.array([-40_000.0, 1_000.0, 45_000.0])
    figure = plots.plot_holdout_diagnostics(actual, predicted)
    low, high = figure.axes[0].get_xlim()
    assert low <= -50_000.0
    assert high >= 50_000.0
    matplotlib.pyplot.close(figure)
