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
  LIB_DIR="$HOME/.local/share/cork"
  APPS_DIR="$HOME/.local/share/applications"
  mkdir -p "$BIN_DIR" "$APPS_DIR"

  # Is a copy already running? Determines whether the user must restart to pick
  # up the new version. Best-effort — a miss only skips the reminder below.
  RUNNING=0
  if pgrep -f "$LIB_DIR/AppRun" >/dev/null 2>&1 || pgrep -x cork >/dev/null 2>&1; then
    RUNNING=1
  fi

  # Extract the AppImage instead of installing it as a single file. Stock
  # Ubuntu 22.04+ (and others) ship only libfuse3, but classic AppImages need
  # libfuse2 — so a bare .AppImage fails on first run with a FUSE error, which
  # is the most common Linux setup there is. Extracting sidesteps FUSE entirely
  # and launches faster on every run. (--appimage-extract is built into the
  # runtime and does not itself need FUSE.)
  info "Unpacking…"
  chmod +x "$FILE"
  (cd "$TMP" && "$FILE" --appimage-extract >/dev/null 2>&1) ||
    die "could not unpack the AppImage."
  [ -x "$TMP/squashfs-root/AppRun" ] || die "unpacked bundle is missing AppRun."

  # Stage on the same filesystem as the destination so the final swap is an
  # atomic rename. A running instance keeps its now-unlinked files until it
  # exits; new launches get the new tree.
  STAGE="$LIB_DIR.new.$$"
  rm -rf "$STAGE"
  mv "$TMP/squashfs-root" "$STAGE"
  rm -rf "$LIB_DIR.old"
  [ -d "$LIB_DIR" ] && mv "$LIB_DIR" "$LIB_DIR.old"
  mv "$STAGE" "$LIB_DIR"
  rm -rf "$LIB_DIR.old"

  # A tiny launcher on PATH keeps the `cork` command stable across updates.
  cat > "$BIN_DIR/cork" <<EOF
#!/bin/sh
exec "$LIB_DIR/AppRun" "\$@"
EOF
  chmod +x "$BIN_DIR/cork"
  ok "Cork installed to $LIB_DIR"

  # Desktop entry (+ the bundle's own icon) so it shows in the app launcher.
  ICON="cork"
  for cand in "$LIB_DIR/.DirIcon" "$LIB_DIR/cork.png" "$LIB_DIR/Cork.png"; do
    if [ -e "$cand" ]; then
      ICON="$cand"
      break
    fi
  done
  cat > "$APPS_DIR/cork.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Cork
Comment=Local-first Markdown notes for developers
Exec=$BIN_DIR/cork %U
Icon=$ICON
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

  printf '\n%sRun it with%s %scork%s or from your app menu.\n' \
    "$DIM" "$RESET" "$BOLD" "$RESET"
fi

printf '\n%sEnjoy Cork!%s\n' "$GREEN" "$RESET"
