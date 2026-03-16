#!/bin/bash
# test/agentic/verify-spec-field/run.sh
# Launch Agentic test container with QA verification

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"

# Configuration
IMAGE_NAME="openspec-agentic-qa"
USER_ID=$(id -u)
GROUP_ID=$(id -g)

# Check prerequisites
if [ -z "${OPENCODE_API_KEY}" ]; then
    echo "Error: OPENCODE_API_KEY environment variable not set"
    echo "Usage: OPENCODE_API_KEY=sk-xxx ./run.sh"
    exit 1
fi

echo "================================"
echo "Agentic Test: Spec Field Integration"
echo "================================"
echo ""
echo "Configuration:"
echo "  User ID: ${USER_ID}:${GROUP_ID}"
echo "  Project: ${PROJECT_ROOT}"
echo "  Image: ${IMAGE_NAME}"
echo ""

# Build image if needed
if ! podman image inspect "${IMAGE_NAME}" &>/dev/null; then
    echo "Building container image..."
    podman build -t "${IMAGE_NAME}" \
        --build-arg USER_ID="${USER_ID}" \
        --build-arg GROUP_ID="${GROUP_ID}" \
        -f "${SCRIPT_DIR}/Containerfile.e2e" \
        "${PROJECT_ROOT}"
    echo "✓ Image built"
else
    echo "✓ Using existing image"
fi

echo ""
echo "Starting agentic test container..."
echo "The QA agent will execute the test plan."
echo ""

# Run container
podman run --rm -it \
    --user "${USER_ID}:${GROUP_ID}" \
    -e OPENCODE_API_KEY="${OPENCODE_API_KEY}" \
    -e OPENCODE_MODEL="${OPENCODE_MODEL:-zhipuai-coding-plan}" \
    -v "${SCRIPT_DIR}/fixtures/opencode-config.json:/home/opentest/.config/opencode/opencode.json:ro,Z" \
    -v "${SCRIPT_DIR}/fixtures/auth.json:/home/opentest/.local/share/opencode/auth.json:ro,Z" \
    -v "${SCRIPT_DIR}/VERIFICATION.md:/app/TESTPLAN.md:ro,Z" \
    -v "${PROJECT_ROOT}:/opt/openspec:ro,Z" \
    -w /app \
    "${IMAGE_NAME}" \
    opencode run --file /app/TESTPLAN.md

echo ""
echo "================================"
echo "Agentic Test Complete"
echo "================================"