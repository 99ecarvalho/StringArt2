#!/bin/sh
# Build the distributable files into dist/.
# Copyright (c) 2025-2026 Eduardo Correia <ecorreia@apliant.com.br>
# SPDX-License-Identifier: LGPL-3.0-or-later
set -e
cd "$(dirname "$0")"
exec node build.js
