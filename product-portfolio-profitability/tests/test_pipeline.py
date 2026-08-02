"""End to end tests for the command line pipeline.

These run the whole analysis against the synthetic fixture. They assert that
the pipeline completes, writes every artefact, and is deterministic. They do
not assert any business result, because the fixture is not the study data.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pandas as pd
import pytest

from portfolio_profitability import pipeline
from portfolio_profitability.config import METRICS_FILENAME, TRAINING_DATA_FILENAME

REPO_ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def completed(raw_dir, tmp_path_factory):
    output = tmp_path_factory.mktemp("pipeline_output")
    result = pipeline.run(
        data_dir=raw_dir,
        processed_dir=output / "processed",
        images_dir=output / "images",
    )
    return {"result": result, "output": output}


def test_pipeline_completes_and_writes_the_training_data(completed):
    export_path = completed["result"]["export_path"]
    assert export_path.exists()

    exported = pd.read_csv(export_path)
    assert list(exported.columns) == pipeline.EXPORT_COLUMNS
    assert len(exported) == len(completed["result"]["prepared"]["product_level"])
    assert set(exported["split"]) == {"train", "test"}
    assert exported["product_no"].is_unique
    assert exported.isna().sum().sum() == 0


def test_split_flag_matches_the_actual_holdout(completed):
    exported = pd.read_csv(completed["result"]["export_path"])
    payload = completed["result"]["metrics_payload"]
    assert int((exported["split"] == "test").sum()) == payload["n_holdout"]
    assert int((exported["split"] == "train").sum()) == payload["n_train"]


def test_metrics_file_is_valid_json_and_complete(completed):
    payload = json.loads(completed["result"]["metrics_path"].read_text())

    for field in (
        "random_state",
        "test_size",
        "target",
        "n_products",
        "n_train",
        "n_holdout",
        "baseline_category",
        "intercept",
        "portfolio_totals",
        "metrics",
        "cross_validation",
        "directional_accuracy_holdout",
        "directional_accuracy_full_sample",
        "concentration",
        "coefficients",
    ):
        assert field in payload

    assert payload["n_train"] + payload["n_holdout"] == payload["n_products"]
    assert len(payload["coefficients"]) == completed["result"]["design_matrix"].shape[1]


def test_every_figure_is_written(completed):
    paths = completed["result"]["figure_paths"]
    assert len(paths) == 7
    for path in paths:
        assert path.exists()
        assert path.stat().st_size > 5_000

    names = {path.name for path in paths}
    assert names == {
        "correlation-heatmap.png",
        "holdout-diagnostics.png",
        "residual-distribution.png",
        "actual-versus-predicted-ranked.png",
        "effect-sizes.png",
        "category-contribution-profit.png",
        "freight-by-weight-band.png",
    }


def test_pipeline_is_deterministic(raw_dir, tmp_path):
    first = pipeline.run(
        data_dir=raw_dir,
        processed_dir=tmp_path / "one",
        images_dir=tmp_path / "one_images",
        make_figures=False,
    )
    second = pipeline.run(
        data_dir=raw_dir,
        processed_dir=tmp_path / "two",
        images_dir=tmp_path / "two_images",
        make_figures=False,
    )

    assert first["export_path"].read_bytes() == second["export_path"].read_bytes()
    assert first["metrics_path"].read_text() == second["metrics_path"].read_text()


def test_pipeline_exits_with_a_clear_error_when_data_is_absent(tmp_path):
    exit_code = pipeline.main(
        ["--data-dir", str(tmp_path / "nothing"), "--no-figures"]
    )
    assert exit_code == 2


def test_module_runs_as_a_script(raw_dir, tmp_path):
    completed_process = subprocess.run(
        [
            sys.executable,
            "-m",
            "portfolio_profitability.pipeline",
            "--data-dir",
            str(raw_dir),
            "--processed-dir",
            str(tmp_path / "processed"),
            "--no-figures",
        ],
        cwd=REPO_ROOT,
        env={"PYTHONPATH": str(REPO_ROOT / "src"), "PATH": "/usr/bin:/bin"},
        capture_output=True,
        text=True,
    )
    assert completed_process.returncode == 0, completed_process.stderr
    assert "RAW INPUT PROVENANCE CHECK" in completed_process.stdout
    assert (tmp_path / "processed" / TRAINING_DATA_FILENAME).exists()
    assert (tmp_path / "processed" / METRICS_FILENAME).exists()


def test_pipeline_warns_when_the_input_is_not_the_recorded_dataset(
    raw_dir, tmp_path, capsys
):
    pipeline.run(
        data_dir=raw_dir,
        processed_dir=tmp_path / "processed",
        images_dir=tmp_path / "images",
        make_figures=False,
    )
    captured = capsys.readouterr().out
    assert "WARNING" in captured
    assert "NOT comparable" in captured
