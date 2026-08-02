"""End to end command line pipeline.

Running this module reproduces the whole analysis from the raw source files:
cleansing, feature construction, model fitting, evaluation, the exported
training data, the metrics file, and every figure.

    python -m portfolio_profitability.pipeline

The pipeline is deterministic. Given the same input files it produces byte
identical numeric output on every run, because the only source of randomness is
the train and test split, which is seeded from ``config.RANDOM_STATE``.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

from . import cleaning, evaluation, features, modeling, plots
from .config import (
    CORRELATION_COLUMNS,
    EXPORT_COLUMNS,
    IMAGES_DIR,
    METRICS_FILENAME,
    PROCESSED_DATA_DIR,
    RANDOM_STATE,
    RAW_DATA_DIR,
    TARGET,
    TEST_SIZE,
    TRAINING_DATA_FILENAME,
)
from .data_loading import (
    RawDataNotFoundError,
    load_raw_tables,
    provenance_report,
    referential_integrity,
)


def build_product_table(tables: dict[str, pd.DataFrame]) -> dict[str, object]:
    """Run the data preparation stages and return the intermediate artefacts."""
    order_items, drop_report = cleaning.drop_unattributable_order_items(
        tables["order_items"]
    )
    products, imputation_report = cleaning.impute_missing_cost(tables["products"])
    orders = cleaning.parse_order_dates(tables["orders"])

    facts = cleaning.add_financial_measures(
        cleaning.build_order_item_facts(order_items, products, orders)
    )
    delivered = cleaning.select_delivered(facts)
    cancelled = cleaning.select_cancelled(facts)
    product_level = features.build_product_level(delivered)

    return {
        "order_items": order_items,
        "products": products,
        "orders": orders,
        "facts": facts,
        "delivered": delivered,
        "cancelled": cancelled,
        "product_level": product_level,
        "drop_report": drop_report,
        "imputation_report": imputation_report,
    }


def run(
    data_dir: Path | None = None,
    processed_dir: Path | None = None,
    images_dir: Path | None = None,
    make_figures: bool = True,
) -> dict[str, object]:
    """Execute the full analysis and return a dictionary of results."""
    raw_dir = Path(data_dir) if data_dir is not None else RAW_DATA_DIR
    out_dir = Path(processed_dir) if processed_dir is not None else PROCESSED_DATA_DIR
    figure_dir = Path(images_dir) if images_dir is not None else IMAGES_DIR

    tables = load_raw_tables(raw_dir)
    print(provenance_report(tables))
    print()

    integrity = referential_integrity(tables["order_items"], tables["orders"])
    print(
        f"Referential integrity: {integrity['matched']:,} of {integrity['rows']:,} "
        f"order items resolve to an order "
        f"({integrity['unmatched_pct']:.2f}% unmatched)"
    )

    prepared = build_product_table(tables)
    delivered = prepared["delivered"]
    product_level = prepared["product_level"]

    drop_report = prepared["drop_report"]
    imputation_report = prepared["imputation_report"]
    print(
        f"Removed {drop_report.removed:,} unattributable order items "
        f"({drop_report.removed_pct:.2f}%)"
    )
    print(
        f"Imputed {imputation_report.imputed:,} missing product costs "
        f"({imputation_report.imputed_pct:.2f}%)"
    )

    varying_price = features.count_products_with_varying_price(delivered)
    if varying_price:
        print(
            f"NOTICE: {varying_price:,} products appear at more than one price. "
            "Unit price and unit cost take the first observed value, so those "
            "products carry an arbitrary representative price."
        )

    totals = cleaning.portfolio_totals(delivered)
    category_table = features.category_summary(delivered)
    band_table = features.freight_by_weight_band(delivered)

    design_matrix, target = features.build_design_matrix(product_level)
    train_x, test_x, train_y, test_y = modeling.split_data(design_matrix, target)
    model = modeling.fit_linear_regression(train_x, train_y)

    predicted_train = model.predict(train_x)
    predicted_test = model.predict(test_x)
    predicted_all = model.predict(design_matrix)

    metric_table = evaluation.regression_metrics(
        train_y, predicted_train, test_y, predicted_test, design_matrix.shape[1]
    )
    cross_validation = evaluation.cross_validated_r2(design_matrix, target)
    holdout_direction = evaluation.directional_accuracy(test_y, predicted_test)
    full_direction = evaluation.directional_accuracy(target, predicted_all)
    coefficients = modeling.coefficient_table(model, design_matrix.columns)

    # Export the product level training data with the split flag.
    out_dir.mkdir(parents=True, exist_ok=True)
    export = product_level.copy()
    export["split"] = ["test" if idx in set(test_x.index) else "train" for idx in export.index]
    export_path = out_dir / TRAINING_DATA_FILENAME
    export[EXPORT_COLUMNS].to_csv(export_path, index=False)
    print(f"Wrote {export_path}")

    holdout_mae = float(
        metric_table.loc[metric_table["metric"] == "MAE", "holdout"].iloc[0]
    )
    metrics_payload = {
        "random_state": RANDOM_STATE,
        "test_size": TEST_SIZE,
        "target": TARGET,
        "n_products": int(len(product_level)),
        "n_train": int(len(train_x)),
        "n_holdout": int(len(test_x)),
        "baseline_category": features.baseline_category(product_level),
        "intercept": float(model.intercept_),
        "portfolio_totals": totals,
        "metrics": metric_table.to_dict(orient="records"),
        "cross_validation": cross_validation,
        "directional_accuracy_holdout": holdout_direction,
        "directional_accuracy_full_sample": full_direction,
        "holdout_mae_as_pct_of_target_sd": evaluation.error_relative_to_spread(
            target, holdout_mae
        ),
        "concentration": evaluation.concentration_summary(product_level),
        "coefficients": coefficients.to_dict(orient="records"),
    }
    metrics_path = out_dir / METRICS_FILENAME
    metrics_path.write_text(json.dumps(metrics_payload, indent=2) + "\n")
    print(f"Wrote {metrics_path}")

    figure_paths: list[Path] = []
    if make_figures:
        figure_paths = [
            plots.save_figure(
                plots.plot_correlation_heatmap(product_level, CORRELATION_COLUMNS),
                "correlation-heatmap.png",
                figure_dir,
            ),
            plots.save_figure(
                plots.plot_holdout_diagnostics(test_y, predicted_test),
                "holdout-diagnostics.png",
                figure_dir,
            ),
            plots.save_figure(
                plots.plot_residual_distribution(test_y, predicted_test),
                "residual-distribution.png",
                figure_dir,
            ),
            plots.save_figure(
                plots.plot_actual_versus_predicted_by_rank(test_y, predicted_test),
                "actual-versus-predicted-ranked.png",
                figure_dir,
            ),
            plots.save_figure(
                plots.plot_effect_sizes(coefficients, design_matrix),
                "effect-sizes.png",
                figure_dir,
            ),
            plots.save_figure(
                plots.plot_category_contribution(category_table),
                "category-contribution-profit.png",
                figure_dir,
            ),
            plots.save_figure(
                plots.plot_freight_by_weight_band(
                    band_table, float(delivered["freight_value"].mean())
                ),
                "freight-by-weight-band.png",
                figure_dir,
            ),
        ]
        for path in figure_paths:
            print(f"Wrote {path}")

    return {
        "tables": tables,
        "prepared": prepared,
        "category_table": category_table,
        "band_table": band_table,
        "design_matrix": design_matrix,
        "target": target,
        "model": model,
        "coefficients": coefficients,
        "metrics": metric_table,
        "metrics_payload": metrics_payload,
        "export_path": export_path,
        "metrics_path": metrics_path,
        "figure_paths": figure_paths,
    }


def main(argv: list[str] | None = None) -> int:
    """Command line entry point."""
    parser = argparse.ArgumentParser(
        description=(
            "Reproduce the product portfolio profitability analysis from the "
            "raw source files."
        )
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=None,
        help="Directory holding the five raw CSV files. Defaults to data/raw.",
    )
    parser.add_argument(
        "--processed-dir",
        type=Path,
        default=None,
        help="Directory for the exported training data and metrics. Defaults to data/processed.",
    )
    parser.add_argument(
        "--images-dir",
        type=Path,
        default=None,
        help="Directory for the generated figures. Defaults to images.",
    )
    parser.add_argument(
        "--no-figures", action="store_true", help="Skip figure generation."
    )
    arguments = parser.parse_args(argv)

    try:
        run(
            data_dir=arguments.data_dir,
            processed_dir=arguments.processed_dir,
            images_dir=arguments.images_dir,
            make_figures=not arguments.no_figures,
        )
    except RawDataNotFoundError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
