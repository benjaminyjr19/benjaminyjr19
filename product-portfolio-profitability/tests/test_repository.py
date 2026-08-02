"""Repository integrity tests.

These guard the properties a reviewer checks first: the declared structure
exists, the notebook is clean and portable, documentation links resolve, and
the dependency files match what the code actually imports.
"""

from __future__ import annotations

import ast
import json
import re
import shutil
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = REPO_ROOT / "src" / "portfolio_profitability"
NOTEBOOK_PATH = REPO_ROOT / "notebook" / "MultipleLinearRegression.ipynb"

REQUIRED_FILES = [
    "README.md",
    "LICENSE",
    ".gitignore",
    "requirements.txt",
    "requirements-dev.txt",
    "environment.yml",
    "pyproject.toml",
    "notebook/MultipleLinearRegression.ipynb",
    "scripts/build_notebook.py",
    "scripts/check_notebook_clean.py",
    "scripts/check_requirements_pinned.py",
    "docs/DATA.md",
    "docs/METHODOLOGY.md",
    "docs/RESULTS.md",
    "docs/REPRODUCIBILITY.md",
    "docs/CHANGES.md",
    "images/README.md",
    ".github/workflows/ci.yml",
]

REQUIRED_DIRECTORIES = [
    "notebook",
    "src/portfolio_profitability",
    "data/raw",
    "data/processed",
    "images",
    "docs",
    "tests",
    "scripts",
    ".github/workflows",
]

# Import name to distribution name, for the packages that differ.
IMPORT_TO_DISTRIBUTION = {
    "sklearn": "scikit-learn",
    "matplotlib": "matplotlib",
    "statsmodels": "statsmodels",
    "pandas": "pandas",
    "numpy": "numpy",
    "IPython": "ipython",
}

STANDARD_LIBRARY = {
    "__future__",
    "argparse",
    "ast",
    "dataclasses",
    "json",
    "os",
    "pathlib",
    "platform",
    "re",
    "subprocess",
    "sys",
    "textwrap",
    "typing",
    "warnings",
}


def _text_files() -> list[Path]:
    patterns = ("*.py", "*.md", "*.yml", "*.yaml", "*.toml", "*.txt", "*.cfg")
    files: list[Path] = []
    for pattern in patterns:
        files.extend(
            path
            for path in REPO_ROOT.rglob(pattern)
            if ".git" not in path.parts and ".venv" not in path.parts
        )
    return files


@pytest.mark.parametrize("relative", REQUIRED_FILES)
def test_required_file_exists(relative):
    path = REPO_ROOT / relative
    assert path.is_file(), f"Missing required file: {relative}"
    assert path.stat().st_size > 0, f"Required file is empty: {relative}"


@pytest.mark.parametrize("relative", REQUIRED_DIRECTORIES)
def test_required_directory_exists(relative):
    assert (REPO_ROOT / relative).is_dir(), f"Missing required directory: {relative}"


def test_notebook_is_valid_and_portable():
    notebook = json.loads(NOTEBOOK_PATH.read_text())

    assert notebook["nbformat"] == 4
    assert notebook["cells"], "The notebook has no cells"
    assert notebook["metadata"]["language_info"]["name"] == "python"

    for index, cell in enumerate(notebook["cells"]):
        assert cell["cell_type"] in {"markdown", "code"}
        if cell["cell_type"] == "code":
            # Outputs are cleared so the committed notebook can never show a
            # result that does not correspond to the code beside it.
            assert cell["outputs"] == [], f"Cell {index} still carries outputs"
            assert cell["execution_count"] is None, f"Cell {index} has an execution count"


def test_the_committed_notebook_matches_its_generator(tmp_path):
    """Regenerating the notebook must reproduce the committed file exactly.

    The notebook is generated from scripts/build_notebook.py. If the two drift
    apart, the generator is no longer the source of truth and a future
    regeneration would silently discard hand edits.
    """
    import subprocess

    workspace = tmp_path / "repo"
    (workspace / "scripts").mkdir(parents=True)
    (workspace / "notebook").mkdir()
    shutil.copy(REPO_ROOT / "scripts" / "build_notebook.py", workspace / "scripts")

    result = subprocess.run(
        [sys.executable, str(workspace / "scripts" / "build_notebook.py")],
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr

    regenerated = workspace / "notebook" / NOTEBOOK_PATH.name
    assert regenerated.read_bytes() == NOTEBOOK_PATH.read_bytes(), (
        "The committed notebook differs from what scripts/build_notebook.py "
        "produces. Re-run the generator, or port your notebook edits into it."
    )


def test_notebook_code_parses_as_python():
    notebook = json.loads(NOTEBOOK_PATH.read_text())
    for index, cell in enumerate(notebook["cells"]):
        if cell["cell_type"] != "code":
            continue
        source = "".join(cell["source"])
        try:
            ast.parse(source)
        except SyntaxError as error:  # pragma: no cover - failure path
            pytest.fail(f"Cell {index} is not valid Python: {error}")


def test_notebook_contains_no_absolute_or_platform_paths():
    source = NOTEBOOK_PATH.read_text()
    for marker in ("/content/", "C:\\\\", "/Users/", "/home/", "google.colab"):
        assert marker not in source, f"Notebook references a machine specific path: {marker}"


def test_no_placeholder_or_unfinished_markers_remain():
    pattern = re.compile(r"\b(TODO|FIXME|XXX|TBD|PLACEHOLDER|LOREM IPSUM)\b")
    offenders = []
    for path in _text_files():
        if path.name == "test_repository.py":
            continue  # This file names the markers in order to search for them.
        for number, line in enumerate(path.read_text().splitlines(), start=1):
            if pattern.search(line):
                offenders.append(f"{path.relative_to(REPO_ROOT)}:{number}")
    assert not offenders, f"Unfinished markers found: {offenders}"


def test_requirements_are_pinned():
    lines = [
        line.strip()
        for line in (REPO_ROOT / "requirements.txt").read_text().splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]
    assert lines, "requirements.txt declares no packages"
    for line in lines:
        assert "==" in line, f"Unpinned requirement: {line}"


def _declared_requirements() -> set[str]:
    declared = set()
    for line in (REPO_ROOT / "requirements.txt").read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            declared.add(line.split("==")[0].strip().lower())
    return declared


def _third_party_imports(directory: Path) -> set[str]:
    found = set()
    for path in sorted(directory.rglob("*.py")):
        tree = ast.parse(path.read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                found.update(alias.name.split(".")[0] for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
                found.add(node.module.split(".")[0])
    return {name for name in found if name not in STANDARD_LIBRARY}


def test_every_third_party_import_is_declared():
    imported = _third_party_imports(SRC_DIR)
    declared = _declared_requirements()
    missing = {
        name
        for name in imported
        if IMPORT_TO_DISTRIBUTION.get(name, name).lower() not in declared
    }
    assert not missing, f"Imported but not declared in requirements.txt: {sorted(missing)}"


# Packages that nothing in this project imports directly, but which are pinned
# anyway. Each one must carry a written justification in requirements.txt, which
# the test below enforces.
PINNED_TRANSITIVE = {"scipy"}

# Packages needed to open and execute the notebook rather than to import it.
NOTEBOOK_RUNTIME = {"ipykernel", "jupyterlab", "nbformat", "nbclient"}


def test_no_declared_requirement_is_unused():
    """Every pinned runtime package must be reachable from the code or notebook."""
    used = {
        IMPORT_TO_DISTRIBUTION.get(name, name).lower()
        for name in _third_party_imports(SRC_DIR)
    }
    notebook_source = NOTEBOOK_PATH.read_text()
    for name, distribution in IMPORT_TO_DISTRIBUTION.items():
        if f"import {name}" in notebook_source or f"from {name}" in notebook_source:
            used.add(distribution.lower())

    used |= NOTEBOOK_RUNTIME | PINNED_TRANSITIVE

    unused = _declared_requirements() - used
    assert not unused, f"Declared but never used: {sorted(unused)}"


def test_every_transitive_pin_is_justified_in_place():
    """A pin nothing imports needs a reason written beside it, not just in a doc."""
    lines = (REPO_ROOT / "requirements.txt").read_text().splitlines()
    for package in PINNED_TRANSITIVE:
        index = next(
            (
                position
                for position, line in enumerate(lines)
                if line.strip().lower().startswith(f"{package}==")
            ),
            None,
        )
        assert index is not None, f"{package} is listed as a transitive pin but absent"

        # Look back over the contiguous comment block directly above the pin.
        explanation = []
        cursor = index - 1
        while cursor >= 0 and lines[cursor].strip().startswith("#"):
            explanation.insert(0, lines[cursor].strip("# ").strip())
            cursor -= 1
        joined = " ".join(explanation)
        assert package in joined.lower(), (
            f"{package} is pinned without a comment above it explaining why"
        )
        assert len(joined) > 60, f"The justification for pinning {package} is too thin"


def test_environment_yml_pins_the_same_versions():
    requirements = {}
    for line in (REPO_ROOT / "requirements.txt").read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            name, version = line.split("==")
            requirements[name.strip().lower()] = version.strip()

    environment = (REPO_ROOT / "environment.yml").read_text()
    for name, version in requirements.items():
        assert (
            f"{name}={version}" in environment or f"{name}=={version}" in environment
        ), f"environment.yml does not pin {name} at {version}"


def test_relative_markdown_links_resolve():
    link_pattern = re.compile(r"\[[^\]]+\]\(([^)]+)\)")
    broken = []
    for path in REPO_ROOT.rglob("*.md"):
        if ".git" in path.parts or ".venv" in path.parts:
            continue
        for target in link_pattern.findall(path.read_text()):
            target = target.split("#")[0].strip()
            if not target or target.startswith(("http://", "https://", "mailto:")):
                continue
            if not (path.parent / target).resolve().exists():
                broken.append(f"{path.relative_to(REPO_ROOT)} -> {target}")
    assert not broken, f"Broken relative links: {broken}"


def test_images_referenced_by_the_readme_exist():
    readme = (REPO_ROOT / "README.md").read_text()
    for target in re.findall(r"!\[[^\]]*\]\(([^)]+)\)", readme):
        if target.startswith(("http://", "https://")):
            continue
        assert (REPO_ROOT / target).is_file(), f"README references a missing image: {target}"


def test_source_contains_no_absolute_paths():
    offenders = []
    for path in SRC_DIR.rglob("*.py"):
        text = path.read_text()
        for marker in ('"/home/', "'/home/", '"/Users/', "'/Users/", "C:\\\\"):
            if marker in text:
                offenders.append(f"{path.relative_to(REPO_ROOT)}: {marker}")
    assert not offenders, f"Absolute paths in source: {offenders}"


def test_documented_test_counts_are_accurate():
    """Every test count stated in the documentation must match reality.

    Documentation that quotes a number is making a factual claim. This asserts
    the claim rather than trusting whoever last edited the file.
    """
    import collections
    import subprocess

    collected = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "tests/",
            "--collect-only",
            "-p",
            "no:cacheprovider",
            "--override-ini=addopts=-q",
        ],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
    )
    assert collected.returncode == 0, collected.stderr

    per_module = collections.Counter(
        re.findall(r"^(tests/test_\w+\.py)::", collected.stdout, re.M)
    )
    total = sum(per_module.values())
    assert total > 0, "Collection produced no tests"

    # The headline total, quoted in README.md and the docs.
    for relative in ("README.md", "docs/RESULTS.md", "docs/REPRODUCIBILITY.md", "docs/CHANGES.md"):
        text = (REPO_ROOT / relative).read_text()
        for quoted in re.findall(r"\b(\d+)\s+(?:passing\s+)?tests\b", text):
            assert int(quoted) == total, (
                f"{relative} claims {quoted} tests but {total} are collected"
            )

    # The per module table in README.md.
    readme = (REPO_ROOT / "README.md").read_text()
    for module, claimed in re.findall(r"\|\s*`(test_\w+\.py)`\s*\|\s*(\d+)\s*\|", readme):
        actual = per_module.get(f"tests/{module}", 0)
        assert int(claimed) == actual, (
            f"README.md claims {claimed} tests in {module} but {actual} are collected"
        )


def test_gitignore_excludes_raw_data_and_environments():
    gitignore = (REPO_ROOT / ".gitignore").read_text()
    for rule in ("data/raw/", "data/processed/", "__pycache__/", ".ipynb_checkpoints"):
        assert rule in gitignore, f".gitignore is missing a rule for {rule}"


def test_data_directories_are_tracked_but_empty_of_csv_files():
    for relative in ("data/raw", "data/processed"):
        directory = REPO_ROOT / relative
        assert (directory / ".gitkeep").is_file(), f"{relative} is not tracked"
        assert not list(directory.glob("*.csv")), (
            f"{relative} contains CSV files, which must not be committed"
        )
