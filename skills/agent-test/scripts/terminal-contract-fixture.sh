#!/usr/bin/env bash
set -euo pipefail

printf '%s\n' '{"event":"agent_test_fixture_progress","phase":"waiting"}' >&2
sleep "${AGENT_TEST_FIXTURE_DELAY_SECONDS:-1}"
printf '%s\n' '{"event":"agent_test_fixture_progress","phase":"done"}' >&2
printf '%s\n' 'FIXTURE_OK'
