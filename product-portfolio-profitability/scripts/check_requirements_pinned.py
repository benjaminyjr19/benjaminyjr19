#!/usr/bin/env python3
"""Fail if any runtime requirement is unpinned.

An unpinned requirement means the environment a reader installs is not the
environment the results were produced in. This project already hit one such
failure: an unpinned scipy resolves to a version that statsmodels 0.14.4 cannot
import. See docs/REPRODUCIBILITY.md.
"""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
REQUIREMENTS = [REPO_ROOT / "requirements.txt", REPO_ROOT / "requirements-dev.txt"]


def unpinned_lines(path: Path) -> list[str]:
    return [
        line.strip()
        for line in path.read_text().splitlines()
        if line.strip()
        and not line.strip().startswith(("#", "-r"))
        and "==" not in line
    ]


def main() -> int:
    failed = False
    for path in REQUIREMENTS:
        if not path.is_file():
            print(f"Missing requirements file: {path.name}")
            failed = True
            continue
        unpinned = unpinned_lines(path)
        if unpinned:
            print(f"{path.name} has unpinned requirements: {unpinned}")
            failed = True
        else:
            print(f"{path.name}: every requirement is pinned.")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
