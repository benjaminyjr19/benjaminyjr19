"""Tests for the evaluation metrics."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest
from sklearn.metrics import r2_score

from portfolio_profitability import evaluation, modeling


def test_adjusted_r2_matches_the_closed_form():
    # 1 - (1 - 0.8) * (100 - 1) / (100 - 5 - 1)
    assert evaluation.adjusted_r2(0.8, 100, 5) == pytest.approx(1 - 0.2 * 99 / 94)


def test_adjusted_r2_never_exceeds_r2():
    assert evaluation.adjusted_r2(0.9, 50, 4) < 0.9


def test_adjusted_r2_rejects_an_undefined_case():
    with pytest.raises(ValueError):
        evaluation.adjusted_r2(0.9, 5, 4)


def test_adjusted_r2_agrees_with_statsmodels(design):
    matrix, target = design
    train_x, _, train_y, _ = modeling.split_data(matrix, target)
    model = modeling.fit_linear_regression(train_x, train_y)
    ols = modeling.fit_ols_summary(train_x, train_y)

    computed = evaluation.adjusted_r2(
        r2_score(train_y, model.predict(train_x)), len(train_y), train_x.shape[1]
    )
    assert computed == pytest.approx(ols.rsquared_adj, rel=1e-9)


def test_rmse_matches_the_manual_calculation():
    actual = np.array([1.0, 2.0, 3.0])
    predicted = np.array([1.0, 2.0, 5.0])
    assert evaluation.root_mean_squared_error(actual, predicted) == pytest.approx(
        (4.0 / 3.0) ** 0.5
    )


def test_metric_table_structure_and_holdout_adjustment(design):
    matrix, target = design
    train_x, test_x, train_y, test_y = modeling.split_data(matrix, target)
    model = modeling.fit_linear_regression(train_x, train_y)

    table = evaluation.regression_metrics(
        train_y,
        model.predict(train_x),
        test_y,
        model.predict(test_x),
        matrix.shape[1],
    )

    assert list(table["metric"]) == ["R squared", "Adjusted R squared", "RMSE", "MAE"]
    # Adjusted R squared is undefined on a holdout set and must stay blank
    # rather than be reported as if it were meaningful.
    holdout_adjusted = table.loc[table["metric"] == "Adjusted R squared", "holdout"]
    assert np.isnan(holdout_adjusted.iloc[0])
    assert table.loc[table["metric"] == "RMSE", "training"].iloc[0] >= 0


def test_rmse_is_never_below_mae(design):
    matrix, target = design
    train_x, test_x, train_y, test_y = modeling.split_data(matrix, target)
    model = modeling.fit_linear_regression(train_x, train_y)
    table = evaluation.regression_metrics(
        train_y, model.predict(train_x), test_y, model.predict(test_x), matrix.shape[1]
    )
    for column in ("training", "holdout"):
        rmse = table.loc[table["metric"] == "RMSE", column].iloc[0]
        mae = table.loc[table["metric"] == "MAE", column].iloc[0]
        assert rmse >= mae - 1e-9


def test_cross_validation_reports_every_fold(design):
    matrix, target = design
    result = evaluation.cross_validated_r2(matrix, target, folds=5)

    assert result["folds"] == 5
    assert len(result["fold_scores"]) == 5
    assert result["mean_r2"] == pytest.approx(float(np.mean(result["fold_scores"])))
    assert result["std_r2"] == pytest.approx(float(np.std(result["fold_scores"])))


def test_cross_validation_is_reproducible(design):
    matrix, target = design
    first = evaluation.cross_validated_r2(matrix, target)
    second = evaluation.cross_validated_r2(matrix, target)
    assert first["fold_scores"] == second["fold_scores"]


def test_directional_accuracy_on_a_hand_worked_example():
    actual = pd.Series([10.0, -5.0, 3.0, -1.0])
    predicted = np.array([2.0, -8.0, -4.0, 7.0])
    # Signs agree on the first two and disagree on the last two.
    result = evaluation.directional_accuracy(actual, predicted)

    assert result["n"] == 4
    assert result["correct"] == 2
    assert result["accuracy_pct"] == pytest.approx(50.0)
    assert result["actual_loss_making"] == 2
    assert result["predicted_loss_making"] == 2


def test_directional_accuracy_is_perfect_when_signs_agree():
    actual = pd.Series([1.0, -1.0, 0.0])
    predicted = np.array([5.0, -5.0, 0.0])
    assert evaluation.directional_accuracy(actual, predicted)["accuracy_pct"] == 100.0


def test_holdout_and_full_sample_directional_accuracy_are_reported_separately(design):
    matrix, target = design
    train_x, test_x, train_y, test_y = modeling.split_data(matrix, target)
    model = modeling.fit_linear_regression(train_x, train_y)

    holdout = evaluation.directional_accuracy(test_y, model.predict(test_x))
    full = evaluation.directional_accuracy(target, model.predict(matrix))

    # The full sample figure includes rows the model was fitted on, so the two
    # are different measurements and must never be conflated.
    assert holdout["n"] == len(test_y)
    assert full["n"] == len(target)
    assert holdout["n"] < full["n"]


def test_error_relative_to_spread_is_a_percentage():
    target = pd.Series([0.0, 10.0, 20.0, 30.0])
    result = evaluation.error_relative_to_spread(target, float(target.std()))
    assert result == pytest.approx(100.0)


def test_concentration_summary_reconciles(product_level):
    summary = evaluation.concentration_summary(product_level)
    assert summary["products"] == len(product_level)
    assert 0 <= summary["contribution_positive_product_pct"] <= 100
    assert summary["contribution_positive_products"] == int(
        (product_level["contribution_profit"] > 0).sum()
    )
