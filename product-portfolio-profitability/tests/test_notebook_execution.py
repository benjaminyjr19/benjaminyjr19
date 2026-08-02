"""Execute the notebook end to end to prove it runs from a clean kernel.

The real source files are not distributed with this repository, so this test
runs the notebook against the synthetic fixture. It proves that every cell
executes in order without manual intervention, that no cell raises, and that
every declared output file is produced. It proves nothing about the business
results, and it must not be read as doing so.

The whole run happens inside a temporary copy of the repository, so no
synthetic output can ever reach the real ``images`` or ``data/processed``
directories.
"""

from __future__ import annotations

import shutil
from pathlib import Path

import pytest

nbformat = pytest.importorskip("nbformat")
nbclient = pytest.importorskip("nbclient")

import synthetic_data  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[1]
NOTEBOOK_PATH = REPO_ROOT / "notebook" / "MultipleLinearRegression.ipynb"

EXPECTED_FIGURES = {
    "category-contribution-profit.png",
    "freight-by-weight-band.png",
    "correlation-heatmap.png",
    "effect-sizes.png",
    "holdout-diagnostics.png",
    "residual-distribution.png",
    "actual-versus-predicted-ranked.png",
}


@pytest.fixture(scope="module")
def executed_workspace(tmp_path_factory) -> Path:
    workspace = tmp_path_factory.mktemp("notebook_run")

    shutil.copytree(REPO_ROOT / "src", workspace / "src")
    (workspace / "notebook").mkdir()
    shutil.copy(NOTEBOOK_PATH, workspace / "notebook" / NOTEBOOK_PATH.name)
    synthetic_data.write_all_tables(workspace / "data" / "raw")

    notebook = nbformat.read(
        str(workspace / "notebook" / NOTEBOOK_PATH.name), as_version=4
    )
    client = nbclient.NotebookClient(
        notebook,
        timeout=600,
        kernel_name="python3",
        resources={"metadata": {"path": str(workspace / "notebook")}},
    )
    client.execute()
    nbformat.write(notebook, str(workspace / "executed.ipynb"))
    return workspace


def test_notebook_executes_without_error(executed_workspace):
    notebook = nbformat.read(str(executed_workspace / "executed.ipynb"), as_version=4)
    code_cells = [
        cell for cell in notebook.cells if cell.cell_type == "code"
    ]
    assert code_cells, "The notebook has no code cells"

    for index, cell in enumerate(code_cells):
        for output in cell.get("outputs", []):
            assert output.get("output_type") != "error", (
                f"Code cell {index} raised "
                f"{output.get('ename')}: {output.get('evalue')}"
            )


def test_every_code_cell_ran_in_order(executed_workspace):
    notebook = nbformat.read(str(executed_workspace / "executed.ipynb"), as_version=4)
    counts = [
        cell.execution_count
        for cell in notebook.cells
        if cell.cell_type == "code"
    ]
    assert None not in counts, "A code cell did not execute"
    assert counts == sorted(counts), "Cells did not execute in document order"
    assert counts == list(range(1, len(counts) + 1))


def test_notebook_writes_the_training_data(executed_workspace):
    export = executed_workspace / "data" / "processed" / "training_data.csv"
    assert export.is_file()
    assert export.stat().st_size > 0


def test_notebook_writes_every_declared_figure(executed_workspace):
    images = executed_workspace / "images"
    assert images.is_dir()
    produced = {path.name for path in images.glob("*.png")}
    assert EXPECTED_FIGURES <= produced, (
        f"Missing figures: {sorted(EXPECTED_FIGURES - produced)}"
    )
    for name in EXPECTED_FIGURES:
        assert (images / name).stat().st_size > 5_000


def test_notebook_reports_the_provenance_warning(executed_workspace):
    """The fixture is not the study data, so the notebook must say so."""
    notebook = nbformat.read(str(executed_workspace / "executed.ipynb"), as_version=4)
    printed = "".join(
        output.get("text", "")
        for cell in notebook.cells
        if cell.cell_type == "code"
        for output in cell.get("outputs", [])
        if output.get("output_type") == "stream"
    )
    assert "RAW INPUT PROVENANCE CHECK" in printed
    assert "WARNING" in printed
