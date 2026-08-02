"""Product portfolio profitability analysis.

A multiple linear regression that estimates the lifetime contribution profit of
a product from the characteristics a decision maker can observe before
committing investment to a range.

The package separates the analysis into stages that can be tested in isolation:

``config``
    Paths, constants, and column lists.
``data_loading``
    Strict loading and profiling of the five raw source tables.
``cleaning``
    Cleansing, date parsing, joining, and the derived financial measures.
``features``
    Aggregation to the product level and construction of the design matrix.
``modeling``
    Model fitting, coefficient reporting, and multicollinearity diagnostics.
``evaluation``
    Regression metrics, cross validation, and directional accuracy.
``plots``
    Publication quality figures.
``pipeline``
    The end to end command line entry point.
"""

from __future__ import annotations

__version__ = "1.0.0"

__all__ = [
    "cleaning",
    "config",
    "data_loading",
    "evaluation",
    "features",
    "modeling",
    "pipeline",
    "plots",
]
