"""Evaluation metrics for the contribution profit regression.

Directional accuracy is reported on the holdout set. Computing it on the full
sample, as the source notebook did, mixes rows the model was fitted on into the
score and reports an optimistically biased number.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, cross_val_score

from .config import CV_FOLDS, RANDOM_STATE


def adjusted_r2(r2: float, n_observations: int, n_predictors: int) -> float:
    """Adjust R squared for the number of predictors in the fitted sample.

    Only meaningful for the sample the model was fitted on. It is undefined for
    a holdout set, where the model consumed no degrees of freedom.
    """
    denominator = n_observations - n_predictors - 1
    if denominator <= 0:
        raise ValueError(
            "Adjusted R squared is undefined when observations do not exceed "
            "predictors plus one."
        )
    return 1 - (1 - r2) * (n_observations - 1) / denominator


def root_mean_squared_error(actual, predicted) -> float:
    """Root mean squared error, computed without the removed ``squared`` flag."""
    return float(mean_squared_error(actual, predicted) ** 0.5)


def regression_metrics(
    target_train: pd.Series,
    predicted_train: np.ndarray,
    target_test: pd.Series,
    predicted_test: np.ndarray,
    n_predictors: int,
) -> pd.DataFrame:
    """Build the training and holdout metric table."""
    r2_train = r2_score(target_train, predicted_train)
    return pd.DataFrame(
        {
            "metric": ["R squared", "Adjusted R squared", "RMSE", "MAE"],
            "training": [
                r2_train,
                adjusted_r2(r2_train, len(target_train), n_predictors),
                root_mean_squared_error(target_train, predicted_train),
                mean_absolute_error(target_train, predicted_train),
            ],
            "holdout": [
                r2_score(target_test, predicted_test),
                np.nan,  # Not applicable. See ``adjusted_r2``.
                root_mean_squared_error(target_test, predicted_test),
                mean_absolute_error(target_test, predicted_test),
            ],
        }
    )


def cross_validated_r2(
    features: pd.DataFrame,
    target: pd.Series,
    folds: int = CV_FOLDS,
    random_state: int = RANDOM_STATE,
) -> dict[str, object]:
    """Run k fold cross validation over the full product set.

    This is a standalone stability check on the whole sample. It is not an
    independent confirmation of the holdout metrics, because the holdout rows
    take part in it.
    """
    scores = cross_val_score(
        LinearRegression(),
        features,
        target,
        cv=KFold(folds, shuffle=True, random_state=random_state),
        scoring="r2",
    )
    return {
        "folds": folds,
        "mean_r2": float(scores.mean()),
        "std_r2": float(scores.std()),
        "fold_scores": [float(score) for score in scores],
    }


def directional_accuracy(actual, predicted) -> dict[str, float]:
    """Share of products whose profit or loss direction the model calls correctly.

    For a portfolio screening decision the sign of the prediction matters more
    than its exact value, because the decision is whether to keep or cut a
    product rather than what it will earn to the dollar.
    """
    actual_values = np.asarray(actual, dtype=float)
    predicted_values = np.asarray(predicted, dtype=float)
    actual_positive = actual_values >= 0
    predicted_positive = predicted_values >= 0
    correct = actual_positive == predicted_positive

    return {
        "n": int(len(actual_values)),
        "actual_loss_making": int((actual_values < 0).sum()),
        "predicted_loss_making": int((predicted_values < 0).sum()),
        "correct": int(correct.sum()),
        "accuracy_pct": float(correct.mean() * 100),
    }


def error_relative_to_spread(target: pd.Series, mae: float) -> float:
    """Express the mean absolute error as a share of the target spread.

    A dollar error is only interpretable against how much the target varies
    across the portfolio.
    """
    spread = float(target.std())
    return mae / spread * 100 if spread else float("nan")


def concentration_summary(product_level: pd.DataFrame) -> dict[str, float]:
    """Describe how revenue concentrates in contribution positive products."""
    revenue_total = product_level["revenue"].sum()
    positive = product_level["contribution_profit"] > 0
    return {
        "products": int(len(product_level)),
        "contribution_positive_products": int(positive.sum()),
        "contribution_positive_product_pct": float(positive.mean() * 100),
        "revenue_share_of_positive_pct": float(
            product_level.loc[positive, "revenue"].sum() / revenue_total * 100
        )
        if revenue_total
        else float("nan"),
    }
