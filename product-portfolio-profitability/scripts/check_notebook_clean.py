#!/usr/bin/env python3
"""Fail if the committed notebook carries stored outputs or execution counts.

A committed output is a claim about a result. The source data is not in this
repository, so a reader cannot regenerate an output to check it, and an output
left behind after the code changed would no longer correspond to the code beside
it. Either way it misleads. See docs/CHANGES.md, change C3.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

NOTEBOOK = Path(__file__).resolve().parents[1] / "notebook" / "MultipleLinearRegression.ipynb"


def main() -> int:
    if not NOTEBOOK.is_file():
        print(f"Notebook not found: {NOTEBOOK}")
        return 1

    notebook = json.loads(NOTEBOOK.read_text())
    offenders = [
        index
        for index, cell in enumerate(notebook["cells"])
        if cell["cell_type"] == "code"
        and (cell.get("outputs") or cell.get("execution_count") is not None)
    ]

    if offenders:
        print(f"Cells with stored outputs or execution counts: {offenders}")
        print("Clear them before committing. See docs/CHANGES.md, change C3.")
        return 1

    print(f"All {len(notebook['cells'])} cells are clean.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
