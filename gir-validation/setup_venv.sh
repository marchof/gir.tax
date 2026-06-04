#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"
REQ_FILE="$SCRIPT_DIR/requirements.txt"

python3 -m venv "$VENV_DIR"

source "$VENV_DIR/bin/activate"
python -m pip install -r "$REQ_FILE"
