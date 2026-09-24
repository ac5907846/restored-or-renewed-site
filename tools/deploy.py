#!/usr/bin/env python3
r"""Publish the committed site to Cloudflare Pages.

Exports the last commit (git archive HEAD) into a temporary folder and
deploys that folder, so what goes live is exactly what is in the
repository: no _archive, no .git, no local files.

Usage:
    py -3 tools/deploy.py
"""

import shutil
import subprocess
import sys
import tarfile
import tempfile
from pathlib import Path

APP = Path(__file__).resolve().parent.parent
PROJECT = "restored-or-renewed"


def main():
    dirty = subprocess.run(["git", "status", "--porcelain"], cwd=APP, capture_output=True, text=True).stdout.strip()
    if dirty:
        print("Uncommitted changes; commit first so the deployment matches the repository:")
        print(dirty)
        sys.exit(1)
    tmp = Path(tempfile.mkdtemp(prefix="site_"))
    try:
        tar = tmp / "site.tar"
        with open(tar, "wb") as fh:
            subprocess.run(["git", "archive", "--format=tar", "HEAD"], cwd=APP, stdout=fh, check=True)
        out = tmp / "site"
        out.mkdir()
        with tarfile.open(tar) as t:
            t.extractall(out)
        tar.unlink()
        n = sum(1 for p in out.rglob("*") if p.is_file())
        print(f"Deploying {n} files from commit "
              f"{subprocess.run(['git', 'rev-parse', '--short', 'HEAD'], cwd=APP, capture_output=True, text=True).stdout.strip()}")
        subprocess.run(["npx", "--yes", "wrangler@latest", "pages", "deploy", str(out),
                        "--project-name", PROJECT, "--branch", "main"], cwd=APP, check=True, shell=True)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main()
