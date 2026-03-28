#!/usr/bin/env bash
# ============================================================
# One-click release script for macOS (Web OTA + optional Android APK)
# Equivalent to release_oneclick.bat
#
# Usage:
#   ./release_oneclick.sh ota   (default) OTA only
#   ./release_oneclick.sh all             OTA + Android APK
#   ./release_oneclick.sh apk             Android APK only
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT_DIR"

# ======================== 用户配置区 ==========================

# --- OTA 通用 ---
CHANNEL="production"
MANDATORY="false"
MIN_NATIVE_VERSION="2.3.0"
RELEASE_NOTES="Hotfix and balance updates"

# --- 部署方式: cos / local / scp ---
DEPLOY_METHOD="cos"

# --- COS 配置（DEPLOY_METHOD=cos 时生效）---
COS_BUCKET="civ-game-ota-1258335979"
COS_REGION="ap-guangzhou"
CDN_BASE_URL="https://civ-game-ota-1258335979.cos-website.ap-guangzhou.myqcloud.com"

# --- local 配置（DEPLOY_METHOD=local 时生效）---
LOCAL_OTA_ROOT="$HOME/deploy/civ-game-ota"

# --- SCP 配置（DEPLOY_METHOD=scp 时生效）---
SCP_TARGET="user@your-server:/var/www/civ-game-ota"
SCP_KEY_PATH=""

# --- coscmd 路径（macOS 用 pip --user 安装时需要完整路径）---
COSCMD="$(command -v coscmd 2>/dev/null || echo "$HOME/Library/Python/3.9/bin/coscmd")"

# ======================== 配置结束 ============================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${CYAN}$*${NC}"; }
ok()    { echo -e "${GREEN}$*${NC}"; }
warn()  { echo -e "${YELLOW}$*${NC}"; }
fail()  { echo -e "${RED}[ERROR] $*${NC}" >&2; }

# ============================================================
#  OTA publish flow
# ============================================================
publish_ota() {
    echo ""
    info "[1/5] Reading version from package.json..."
    APP_VERSION="$(node -p "require('./package.json').version")"
    if [[ -z "$APP_VERSION" ]]; then
        fail "Cannot read version from package.json"
        return 1
    fi

    UTC_TAG="$(date -u +'%Y%m%d-%H%M%S')"
    WEB_VERSION="${APP_VERSION}-ota-${UTC_TAG}"
    BUNDLE_FILE="civ-game-${WEB_VERSION}.zip"

    TMP_DIR="${ROOT_DIR}/.release_tmp"
    TMP_BUNDLES="${TMP_DIR}/bundles"
    TMP_CHANNEL="${TMP_DIR}/${CHANNEL}"
    TMP_MANIFEST="${TMP_CHANNEL}/updates.json"
    TMP_ZIP="${TMP_BUNDLES}/${BUNDLE_FILE}"

    rm -rf "$TMP_DIR"
    mkdir -p "$TMP_BUNDLES" "$TMP_CHANNEL"

    info "[2/5] Building web assets (npm run build)..."
    npm run build
    if [[ ! -f "${ROOT_DIR}/dist/index.html" ]]; then
        fail "dist/index.html not found after build"
        return 1
    fi

    info "[3/5] Creating OTA zip bundle..."
    node scripts/create_ota_zip.cjs "$TMP_ZIP" dist
    if [[ ! -f "$TMP_ZIP" ]]; then
        fail "Failed to create zip bundle"
        return 1
    fi

    BUNDLE_SHA256="$(shasum -a 256 "$TMP_ZIP" | awk '{print $1}')"
    if [[ -z "$BUNDLE_SHA256" ]]; then
        fail "Failed to compute SHA256"
        return 1
    fi

    # Determine download URL
    case "$DEPLOY_METHOD" in
        cos)   DOWNLOAD_URL="${CDN_BASE_URL}/ota/bundles/${BUNDLE_FILE}" ;;
        local) DOWNLOAD_URL="http://localhost/ota/bundles/${BUNDLE_FILE}" ;;
        scp)   DOWNLOAD_URL="https://your-server.com/ota/bundles/${BUNDLE_FILE}" ;;
        *)     fail "Unknown DEPLOY_METHOD: $DEPLOY_METHOD"; return 1 ;;
    esac

    info "[4/5] Generating updates.json (capgo format)..."
    node -e "
const fs = require('fs');
fs.writeFileSync('${TMP_MANIFEST}', JSON.stringify({
    version: '${WEB_VERSION}',
    url: '${DOWNLOAD_URL}',
    checksum: '${BUNDLE_SHA256}'
}, null, 2));
"
    if [[ ! -f "$TMP_MANIFEST" ]]; then
        fail "Failed to generate updates.json"
        return 1
    fi

    info "[5/5] Deploying OTA files (${DEPLOY_METHOD})..."
    case "$DEPLOY_METHOD" in
        cos)   deploy_cos   ;;
        local) deploy_local ;;
        scp)   deploy_scp   ;;
    esac

    echo ""
    echo "============================== OTA Summary =============================="
    echo "  channel : ${CHANNEL}"
    echo "  version : ${WEB_VERSION}"
    echo "  bundle  : ${BUNDLE_FILE}"
    echo "  sha256  : ${BUNDLE_SHA256}"
    echo "  url     : ${DOWNLOAD_URL}"
    echo "  deploy  : ${DEPLOY_METHOD}"
    echo "========================================================================="
}

# ============================================================
#  COS deployment via coscmd
# ============================================================
deploy_cos() {
    if [[ ! -x "$COSCMD" ]] && ! command -v coscmd &>/dev/null; then
        fail "coscmd not found. Install: pip3 install --user coscmd"
        echo "  Then configure: coscmd config -a SecretID -s SecretKey -b Bucket -r Region"
        return 1
    fi

    info "  Uploading bundle zip to COS..."
    "$COSCMD" upload "$TMP_ZIP" "ota/bundles/${BUNDLE_FILE}"

    info "  Uploading updates.json to COS..."
    "$COSCMD" upload -f "$TMP_MANIFEST" "ota/${CHANNEL}/updates.json"

    ok "  COS deployment successful."

    # Clean up old bundles: keep last 5
    info "  Cleaning old bundles (keeping last 5)..."
    local old_bundles
    old_bundles=$("$COSCMD" list -n 100 ota/bundles/ 2>/dev/null \
        | grep -o 'ota/bundles/civ-game-.*\.zip' \
        | sort -r \
        | tail -n +6) || true
    if [[ -n "$old_bundles" ]]; then
        while IFS= read -r f; do
            warn "  Deleting old bundle: $f"
            "$COSCMD" delete "$f" 2>/dev/null || true
        done <<< "$old_bundles"
    else
        echo "  No old bundles to clean."
    fi
}

# ============================================================
#  Local file deployment
# ============================================================
deploy_local() {
    if [[ -z "$LOCAL_OTA_ROOT" ]]; then
        fail "LOCAL_OTA_ROOT is empty"
        return 1
    fi
    mkdir -p "${LOCAL_OTA_ROOT}/bundles" "${LOCAL_OTA_ROOT}/${CHANNEL}"
    cp "$TMP_ZIP" "${LOCAL_OTA_ROOT}/bundles/${BUNDLE_FILE}"
    cp "$TMP_MANIFEST" "${LOCAL_OTA_ROOT}/${CHANNEL}/updates.json"
    ok "  Local deployment successful: ${LOCAL_OTA_ROOT}"
}

# ============================================================
#  SCP deployment
# ============================================================
deploy_scp() {
    if ! command -v scp &>/dev/null; then
        fail "scp not found"
        return 1
    fi
    if [[ -z "$SCP_TARGET" ]]; then
        fail "SCP_TARGET is empty"
        return 1
    fi

    local scp_opts=()
    if [[ -n "$SCP_KEY_PATH" ]]; then
        scp_opts+=(-i "$SCP_KEY_PATH")
    fi

    scp "${scp_opts[@]}" "$TMP_ZIP" "${SCP_TARGET}/bundles/${BUNDLE_FILE}"
    scp "${scp_opts[@]}" "$TMP_MANIFEST" "${SCP_TARGET}/${CHANNEL}/updates.json"
    ok "  SCP deployment successful: ${SCP_TARGET}"
}

# ============================================================
#  Android APK build
# ============================================================
build_apk() {
    echo ""
    info "[APK] Building Android release..."
    npm run build

    npx cap sync android

    if [[ ! -f "${ROOT_DIR}/android/gradlew" ]]; then
        fail "android/gradlew not found"
        return 1
    fi

    cd "${ROOT_DIR}/android"
    chmod +x gradlew
    ./gradlew assembleRelease
    cd "$ROOT_DIR"

    APK_PATH="${ROOT_DIR}/android/app/build/outputs/apk/release/app-release.apk"
    if [[ ! -f "$APK_PATH" ]]; then
        APK_PATH="${ROOT_DIR}/android/app/build/outputs/apk/release/app-release-unsigned.apk"
    fi
    if [[ ! -f "$APK_PATH" ]]; then
        fail "APK not found after build"
        return 1
    fi

    OUT_APK_DIR="${ROOT_DIR}/release/apk"
    mkdir -p "$OUT_APK_DIR"
    cp "$APK_PATH" "${OUT_APK_DIR}/app-release-${APP_VERSION}.apk" \
        && ok "APK output: ${OUT_APK_DIR}/app-release-${APP_VERSION}.apk" \
        || warn "[WARN] APK built but copy to release/apk failed"
}

# ============================================================
#  Main
# ============================================================
MODE="${1:-ota}"

case "$MODE" in
    ota)
        publish_ota
        ;;
    all)
        publish_ota
        build_apk
        ;;
    apk)
        build_apk
        ;;
    *)
        fail "Unknown mode: $MODE"
        echo "Usage: $0 ota | all | apk"
        exit 1
        ;;
esac

# Cleanup
rm -rf "${ROOT_DIR}/.release_tmp"

echo ""
ok "============================================================"
ok " All done!"
ok "============================================================"
