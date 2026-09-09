#!/bin/sh
# Cork installer — https://gaalv.cloud/cork
#
#   curl -fsSL https://gaalv.cloud/cork | sh
#
# Detects your OS/arch, downloads the latest release from GitHub, and installs
# Cork. macOS gets Cork.app in /Applications (quarantine stripped, since the
# developer-preview builds are unsigned); Linux gets an AppImage in
# ~/.local/bin plus a desktop entry.
set -eu

REPO="gaalv/cork"
API="https://api.github.com/repos/${REPO}/releases/latest"

# --- pretty output -----------------------------------------------------------
if [ -t 1 ]; then
  BOLD="$(printf '\033[1m')"; DIM="$(printf '\033[2m')"
  RED="$(printf '\033[31m')"; GREEN="$(printf '\033[32m')"
  BLUE="$(printf '\033[34m')"; RESET="$(printf '\033[0m')"
else
  BOLD=""; DIM=""; RED=""; GREEN=""; BLUE=""; RESET=""
fi
info()  { printf '%s==>%s %s\n' "$BLUE" "$RESET" "$1"; }
ok()    { printf '%s✓%s %s\n'   "$GREEN" "$RESET" "$1"; }
die()   { printf '%serror:%s %s\n' "$RED" "$RESET" "$1" >&2; exit 1; }

command -v curl >/dev/null 2>&1 || die "curl is required but not installed."
command -v tar  >/dev/null 2>&1 || true

# --- detect platform ---------------------------------------------------------
OS="$(uname -s)"
ARCH="$(uname -m)"
ASSET_MATCH=""

case "$OS" in
  Darwin)
    case "$ARCH" in
      arm64)  ASSET_MATCH="Cork_aarch64.app.tar.gz" ;;
      x86_64) ASSET_MATCH="Cork_x64.app.tar.gz" ;;
      *) die "unsupported macOS architecture: $ARCH" ;;
    esac
    ;;
  Linux)
    case "$ARCH" in
      x86_64|amd64) ASSET_MATCH="_amd64.AppImage" ;;
      aarch64|arm64)
        die "Cork does not ship a Linux ARM build yet. Build from source: https://github.com/${REPO}#prerequisites-build-from-source" ;;
      *) die "unsupported Linux architecture: $ARCH" ;;
    esac
    ;;
  *)
    die "unsupported OS: $OS (this installer covers macOS and Linux)" ;;
esac

# --- resolve download URL from the latest release ----------------------------
info "Looking up the latest Cork release…"
URL="$(curl -fsSL "$API" \
  | grep '"browser_download_url"' \
  | grep "$ASSET_MATCH" \
  | head -n1 \
  | sed -E 's/.*"(https[^"]+)".*/\1/')"

[ -n "$URL" ] || die "could not find a download for $OS/$ARCH in the latest release."

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
FILE="$TMP/$(basename "$URL")"

info "Downloading $(basename "$URL")…"
curl -fSL# "$URL" -o "$FILE"

# --- install -----------------------------------------------------------------
if [ "$OS" = "Darwin" ]; then
  command -v tar >/dev/null 2>&1 || die "tar is required to unpack the app bundle."
  info "Unpacking…"
  tar -xzf "$FILE" -C "$TMP"
  APP="$(find "$TMP" -maxdepth 2 -name 'Cork.app' -type d | head -n1)"
  [ -n "$APP" ] || die "Cork.app not found inside the archive."

  DEST="/Applications"
  if [ ! -w "$DEST" ]; then
    DEST="$HOME/Applications"
    mkdir -p "$DEST"
    info "No write access to /Applications — installing to $DEST instead."
  fi

  # The update notice lives inside the app, so Cork is usually running when this
  # script is invoked. macOS won't launch a new build while an instance with the
  # same bundle id is alive (open just reactivates the old one), and replacing a
  # live bundle is untidy — so quit it first, then reopen the new build below.
  if pgrep -x Cork >/dev/null 2>&1; then
    info "Quitting the running Cork…"
    osascript -e 'tell application "Cork" to quit' >/dev/null 2>&1 || true
    n=0
    while pgrep -x Cork >/dev/null 2>&1 && [ "$n" -lt 20 ]; do
      sleep 0.5
      n=$((n + 1))
    done
    pkill -x Cork 2>/dev/null || true
  fi

  rm -rf "$DEST/Cork.app"
  mv "$APP" "$DEST/Cork.app"
  # Builds are unsigned; strip the quarantine flag so Gatekeeper won't block.
  xattr -dr com.apple.quarantine "$DEST/Cork.app" 2>/dev/null || true

  ok "Cork installed to $DEST/Cork.app"
  info "Launching…"
  open "$DEST/Cork.app" || true
  printf '\n%sTip:%s open it anytime with %sopen -a Cork%s\n' "$DIM" "$RESET" "$BOLD" "$RESET"

else
  BIN_DIR="$HOME/.local/bin"
  mkdir -p "$BIN_DIR"

  # Is a copy already running? A running AppImage is mounted from its file, so
  # this matters for how we replace it and whether the user must restart.
  RUNNING=0
  if pgrep -f "$BIN_DIR/cork" >/dev/null 2>&1 || pgrep -x cork >/dev/null 2>&1; then
    RUNNING=1
  fi

  # Atomic replace: overwriting the AppImage in place (what install/cp do, by
  # truncating it) can crash a running instance mounted from that same file.
  # Write beside it and rename — rename swaps the directory entry while the
  # live process keeps the old inode until it exits.
  NEW="$BIN_DIR/.cork.new.$$"
  cp "$FILE" "$NEW"
  chmod +x "$NEW"
  mv -f "$NEW" "$BIN_DIR/cork"
  ok "Cork installed to $BIN_DIR/cork"

  # Desktop entry so it shows up in the app launcher.
  APPS_DIR="$HOME/.local/share/applications"
  mkdir -p "$APPS_DIR"
  cat > "$APPS_DIR/cork.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Cork
Comment=Local-first Markdown notes for developers
Exec=$BIN_DIR/cork %U
Icon=cork
Terminal=false
Categories=Office;Utility;
EOF
  ok "Created desktop entry"

  case ":$PATH:" in
    *":$BIN_DIR:"*) : ;;
    *) printf '\n%sNote:%s %s is not on your PATH. Add this to your shell rc:\n  %sexport PATH="$HOME/.local/bin:$PATH"%s\n' \
         "$DIM" "$RESET" "$BIN_DIR" "$BOLD" "$RESET" ;;
  esac

  if [ "$RUNNING" -eq 1 ]; then
    printf '\n%sCork is still running the previous version%s — quit and reopen it to finish updating.\n' \
      "$BOLD" "$RESET"
  fi

  printf '\n%sRun it with%s %scork%s%s (or from your app menu). If it fails with a FUSE error, run%s\n  %scork --appimage-extract-and-run%s\n' \
    "$DIM" "$RESET" "$BOLD" "$RESET" "$DIM" "$RESET" "$BOLD" "$RESET"
fi

printf '\n%sEnjoy Cork!%s\n' "$GREEN" "$RESET"
