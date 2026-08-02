"""Model fitting, coefficient reporting, and multicollinearity diagnostics."""

from __future__ import annotations

import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split

from .config import RANDOM_STATE, TEST_SIZE


def split_data(
    features: pd.DataFrame,
    target: pd.Series,
    test_size: float = TEST_SIZE,
    random_state: int = RANDOM_STATE,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
    """Split into a training set and a holdout set with a fixed seed."""
    return train_test_split(
        features, target, test_size=test_size, random_state=random_state
    )


def fit_linear_regression(
    features_train: pd.DataFrame, target_train: pd.Series
) -> LinearRegression:
    """Fit an ordinary least squares multiple linear regression."""
    model = LinearRegression()
    model.fit(features_train, target_train)
    return model


def coefficient_table(
    model: LinearRegression, columns: list[str] | pd.Index
) -> pd.DataFrame:
    """Return the fitted coefficients sorted from most to least positive."""
    return (
        pd.DataFrame({"variable": list(columns), "coefficient": model.coef_})
        .sort_values("coefficient", ascending=False)
        .reset_index(drop=True)
    )


def category_effects(coefficients: pd.DataFrame, prefix: str = "cat_") -> pd.DataFrame:
    """Extract the one hot category coefficients with readable labels."""
    effects = coefficients[coefficients["variable"].str.startswith(prefix)].copy()
    effects["category"] = effects["variable"].str.replace(prefix, "", regex=False)
    return effects[["category", "coefficient"]].reset_index(drop=True)


def fit_ols_summary(features_train: pd.DataFrame, target_train: pd.Series):
    """Fit the same specification with statsmodels for inferential statistics.

    scikit-learn does not expose standard errors, t statistics, or p values.
    statsmodels does, and fitting the identical design matrix gives identical
    point estimates.
    """
    import statsmodels.api as sm

    return sm.OLS(target_train, sm.add_constant(features_train)).fit()


def variance_inflation_factors(features: pd.DataFrame) -> pd.DataFrame:
    """Return the variance inflation factor of every explanatory variable.

    A constant column is added before the calculation. Without it the factors
    are computed against regressions through the origin and are not
    interpretable.
    """
    import statsmodels.api as sm
    from statsmodels.stats.outliers_influence import variance_inflation_factor

    with_constant = sm.add_constant(features)
    values = [
        variance_inflation_factor(with_constant.values, position)
        for position in range(with_constant.shape[1])
    ]
    result = pd.DataFrame({"variable": with_constant.columns, "vif": values})
    return result[result["variable"] != "const"].reset_index(drop=True)
