#!/bin/bash
# SessionStart hook: installs pinned third-party Claude Code tools in cloud sessions.
#
# Every source is pinned to the exact commit/version that was reviewed. To upgrade a
# tool, review the new version, then bump its pin below.
# Skip tools with a comma list, e.g. CLAUDE_TOOLS_SKIP="strix,claude-mem".
# Idempotent: finished installs leave a marker in ~/.claude/.pinned-tools and are skipped.
set -uo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

SKILLS="$HOME/.claude/skills"
STATE="$HOME/.claude/.pinned-tools"
LOG="$HOME/.claude/pinned-tools.log"
mkdir -p "$SKILLS" "$STATE" "$HOME/.local/bin"
export PATH="$HOME/.local/bin:$PATH"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

exec >>"$LOG" 2>&1
echo "=== $(date -u +%FT%TZ) session-start ==="

skip() { case ",${CLAUDE_TOOLS_SKIP:-}," in *",$1,"*) return 0 ;; esac; return 1; }

# fetch <name> <repo-url> <sha>  ->  checkout in $WORK/<name>
fetch() {
  local d="$WORK/$1"
  mkdir -p "$d" && git -C "$d" init -q && git -C "$d" remote add origin "$2" \
    && git -C "$d" fetch -q --depth 1 origin "$3" && git -C "$d" checkout -q FETCH_HEAD
}

# tool <name> <pin> <function>: run once per pin, never fail the session
tool() {
  local name="$1" pin="$2" fn="$3"
  skip "$name" && { echo "skip $name"; return; }
  [ -f "$STATE/$name-$pin" ] && { echo "ok   $name ($pin) already installed"; return; }
  if "$fn"; then touch "$STATE/$name-$pin"; echo "ok   $name ($pin) installed"
  else echo "WARN $name ($pin) failed to install"; fi
}

copy_skill() { rm -rf "$SKILLS/$(basename "$1")" && cp -rL "$1" "$SKILLS/"; }

# UI UX Pro Max (MIT) — nextlevelbuilder/ui-ux-pro-max-skill
UIUX_SHA=67803eac81607188194aea9842a723b89326d90d
install_uiux() {
  fetch uiux https://github.com/nextlevelbuilder/ui-ux-pro-max-skill "$UIUX_SHA" || return 1
  copy_skill "$WORK/uiux/.claude/skills/ui-ux-pro-max" && rm -rf "$SKILLS/ui-ux-pro-max/scripts/tests"
}

# /brag + /brag-slim launch-video skills (MIT) — latent-spaces/brag. Rendering uses `npx hyperframes`.
BRAG_SHA=8531ccb9f471ef5099abf930079e47b55c55bb21
install_brag() {
  fetch brag https://github.com/latent-spaces/brag "$BRAG_SHA" || return 1
  copy_skill "$WORK/brag/skills/brag" && copy_skill "$WORK/brag/skills/brag-slim"
}

# Skills only (not its settings/hooks, which are the author's personal config) — philoserf/claude-code-setup (MIT)
SETUP_SHA=3ab37eb87873eecc18b85183472760aec34de399
install_setup() {
  fetch setup https://github.com/philoserf/claude-code-setup "$SETUP_SHA" || return 1
  local s; for s in "$WORK"/setup/skills/*/; do copy_skill "${s%/}" || return 1; done
}

# Agent Reach (MIT) — safe mode: no system packages, no cookie extraction
REACH_SHA=94f06c1969dfc1834001269d79d3ad0972d9dee6
install_reach() {
  command -v uv >/dev/null || return 1
  fetch reach https://github.com/Panniantong/Agent-Reach "$REACH_SHA" || return 1
  uv tool install --force "$WORK/reach" || return 1
  mkdir -p "$SKILLS/agent-reach" && cp -r "$WORK/reach/agent_reach/skill/." "$SKILLS/agent-reach/"
}

# Strix (Apache-2.0) — installs the CLI only; it never runs a scan from here.
STRIX_SHA=f7a32ae62d94872631bc8415073868d02a6ffdaf
install_strix() {
  command -v uv >/dev/null || return 1
  fetch strix https://github.com/usestrix/strix "$STRIX_SHA" || return 1
  uv tool install --force "$WORK/strix"
}

# claude-mem (Apache-2.0) — telemetry off, cloud sync off, background worker NOT auto-started.
MEM_VERSION=13.35.0
install_mem() {
  command -v npx >/dev/null || return 1
  DO_NOT_TRACK=1 npx -y "claude-mem@$MEM_VERSION" install --ide claude-code --provider claude --no-auto-start </dev/null || return 1
  DO_NOT_TRACK= npx -y "claude-mem@$MEM_VERSION" telemetry disable </dev/null
}

tool ui-ux-pro-max "${UIUX_SHA:0:7}" install_uiux
tool brag "${BRAG_SHA:0:7}" install_brag
tool claude-code-setup "${SETUP_SHA:0:7}" install_setup
tool agent-reach "${REACH_SHA:0:7}" install_reach
tool strix "${STRIX_SHA:0:7}" install_strix
tool claude-mem "$MEM_VERSION" install_mem

echo "done"
exit 0
