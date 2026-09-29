#!/usr/bin/env bash
# The Development Sets' keys into the key user's custody, the blind scorer installed, and the pipeline's
# user who alone writes the runs it scores (ticket 24s; ADR 0026 as amended; ADR 0041; session 06's
# ruling: "`vxrun` alone runs the posting path from a root-owned installed copy and writes the posting
# runs' folders; the scorer refuses a folder `vxrun` did not write").
#
# Run by the owner, as root, in a WSL terminal, from the checkout of main, after confirming the drafted
# keys on the review page (tools/scorer/review.py) and reading this file in full:
#   cd ~/vextrus-cubit && sudo bash scripts/owner/keys-custody.sh
# Run it again whenever tools/scorer/ or scripts/real_drawings/ changes on main: it installs main's
# committed files again (never the working tree's), and skips the keys when there is no draft.
#
# What it does, in order (each step says what it did; any failure stops it):
#   1. checks this machine: root, the key user, sudo 1.9.10 or later, the checkout on main;
#   2. the drafts: refuses any whose recorded drawings' sha256 are not the set's files (naming the file);
#      moves each set's key (never copies) into /home/<key user>/keys, the key user's alone; removes every
#      file of the drafts folder by name; checks that your user can read no key and no copy of one;
#   3. installs the scorer, root's, at /usr/local/bin/vx-score (`#!/usr/bin/python3 -I` and main's
#      tools/scorer/score.py), and the key user's log;
#   4. makes the pipeline's user, vxrun, who alone may write the drop folder; the spool your user fills;
#      main's scripts/real_drawings/ as root's installed copy with its launcher and root's copy of uv;
#   5. installs one sudoers file: your user runs the installed command as vxrun, and vxrun runs the
#      poster and the scorer (on exactly one run id) as the key user, all without a password;
#   6. proves each wall.
set -euo pipefail

OWNER=riz
KEY_USER=vxkeys
RUN_USER=vxrun
ROOT=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
DRAFTS=$ROOT/.private/work/keys-draft
REFERENCE=$ROOT/.private/reference
SETS=(sample-project edison)
KEY_DIR=/home/$KEY_USER/keys
SCORE_LOG=/home/$KEY_USER/score.log
SCORER=/usr/local/bin/vx-score
SYSTEM_PYTHON=/usr/bin/python3
RUN_HOME=/var/lib/$RUN_USER
LIB=/usr/local/lib/vextrus
INSTALLED=$LIB/runner
RUNNER=$LIB/real-drawings-run
BIN=$LIB/bin
SPOOL=/srv/vextrus-spool
DROP=/srv/vextrus-drop
RULE=/etc/sudoers.d/93-vextrus-runner
# The installed copy: scripts/real_drawings/runner.py's FILES (a test keeps the two lists equal).
RUNNER_FILES=(
  scripts/__init__.py
  scripts/real_drawings/__init__.py
  scripts/real_drawings/command.py
  scripts/real_drawings/diff.py
  scripts/real_drawings/drop.py
  scripts/real_drawings/runner.py
  scripts/real_drawings/sandbox.py
  scripts/real_drawings/schema.py
  scripts/real_drawings/source.py
  scripts/real_drawings/wheels.py
  tools/__init__.py
  tools/lint/__init__.py
  tools/lint/engine_paths.py
  tools/lint/lock_sources.py
)

step() { printf '\n== %s\n' "$1"; }
ok() { printf '  ok: %s\n' "$1"; }
warn() { printf '  WARNING: %s\n' "$1"; }
die() { printf '  FAILED: %s\n' "$1"; exit 1; }
confirm() { local reply; read -r -p "  $1 [y/N] " reply; [[ "$reply" =~ ^[Yy] ]]; }
as_owner() { sudo -u "$OWNER" -- "$@"; }
# A file of main's commit, read by git as your user (git never runs as root in your checkout: a
# repository's config can run a program).
from_main() { as_owner git -C "$ROOT" show "main:$1"; }
tmp=$(mktemp -d)
trap 'rm -f -- "$tmp"/*; rmdir -- "$tmp"' EXIT

step "1/6 Check this machine"
[ "$(id -u)" = 0 ] || die "run this as root: sudo bash scripts/owner/keys-custody.sh"
id "$OWNER" >/dev/null 2>&1 || die "no user $OWNER"
id "$KEY_USER" >/dev/null 2>&1 || die "no key user $KEY_USER: run scripts/owner/custody-setup.sh first"
[ "$(stat -c %a "/home/$KEY_USER")" = 700 ] || die "/home/$KEY_USER is not mode 700 (ADR 0026)"
[ -d "$KEY_DIR" ] || die "no $KEY_DIR: run scripts/owner/custody-setup.sh first"
version=$(sudo -V | sed -n 's/^Sudo version \([0-9.]*\).*/\1/p')
printf '%s\n1.9.10\n' "$version" | sort -V -C -r 2>/dev/null \
  || die "sudo $version is older than 1.9.10, which the scorer's run-id rule needs"
[ "$(as_owner git -C "$ROOT" symbolic-ref --short HEAD)" = main ] || die "check out main in $ROOT first"
[ -d "$DROP" ] || die "no drop folder $DROP: run scripts/owner/drop-setup.sh first"
# The pipeline's user asks the installed poster which commits GitHub holds (`post-status head`).
from_main scripts/owner/post-status | cmp -s - "$LIB/post-status" \
  || die "the installed poster is not main's: run scripts/owner/drop-setup.sh first"
PIN=$(from_main toolchain/python.version | tr -d '[:space:]')
PYTHON=/opt/vextrus/python/cpython-$PIN-linux-x86_64-gnu/bin/python3
[ -x "$PYTHON" ] || die "the toolchain's Python $PYTHON is not installed"
# What runs as another user must be root's alone, and so must the interpreter's whole tree.
for tree in "$(dirname "$(dirname "$(readlink -f "$PYTHON")")")" "$(readlink -f "$SYSTEM_PYTHON")"; do
  bad=$(find "$tree" \( ! -user root -o -perm /022 \) ! -type l -print -quit)
  [ -z "$bad" ] || die "$bad is not root's alone: fix that before anything runs as another user from it"
done
ok "root; $KEY_USER's home is 700; sudo $version; $ROOT is on main; the interpreters are root's alone"

step "2/6 The drafted keys"
drafted=()
for set in "${SETS[@]}"; do
  [ -f "$DRAFTS/$set.json" ] && drafted+=("$set")
done
if [ "${#drafted[@]}" = 0 ]; then
  ok "no draft in $DRAFTS: the keys step is skipped"
else
  from_main tools/scorer/drafts.py > "$tmp/drafts.py"
  chmod 0644 "$tmp/drafts.py"
  chmod 0755 "$tmp"
  for set in "${drafted[@]}"; do
    [ ! -e "$KEY_DIR/$set.json" ] || die "$set already has a key in custody; move it aside by hand first"
    # The ruling of session 06: a draft keys the drawings it names, by their sha256.
    as_owner "$SYSTEM_PYTHON" -I "$tmp/drafts.py" --reference "$REFERENCE/$set" "$DRAFTS/$set.json" \
      || die "the $set draft does not key the drawings it names (above); nothing was moved"
  done
  echo "  Drafts to take into custody: ${drafted[*]}"
  confirm "Did you confirm these on the review page, with your changes applied?" \
    || die "nothing was moved; confirm the drafts first"
  for set in "${drafted[@]}"; do
    size=$(stat -c %s "$DRAFTS/$set.json")
    sha=$(sha256sum < "$DRAFTS/$set.json" | cut -d' ' -f1)
    mv -- "$DRAFTS/$set.json" "$KEY_DIR/$set.json"
    chown "$KEY_USER:$KEY_USER" "$KEY_DIR/$set.json"
    chmod 0600 "$KEY_DIR/$set.json"
    printf '%s %s %s\n' "$set" "$size" "$sha" >> "$tmp/moved"
    ok "moved the $set key into $KEY_DIR (the key user's alone)"
  done
  # Every other file of the drafts folder may hold a key's values (per-file drafts, notes, the review
  # page): each is removed by name, then each folder once empty.
  count=$(find "$DRAFTS" \( -type f -o -type l \) | wc -l)
  echo "  $count more file(s) in $DRAFTS (per-file drafts, notes, the review page) are removed by name."
  confirm "Remove them?" || die "the drafts folder was left; remove it before any scored loop starts"
  while IFS= read -r -d '' file; do rm -f -- "$file"; done \
    < <(find "$DRAFTS" \( -type f -o -type l \) -print0)
  while IFS= read -r -d '' folder; do rmdir -- "$folder"; done < <(find "$DRAFTS" -depth -type d -print0)
  ok "removed the drafts folder's files by name, and the folder"
  # No copy of a moved key within your user's reach: same size, then same sha256.
  while read -r set size sha; do
    while IFS= read -r -d '' candidate; do
      if [ "$(sha256sum < "$candidate" | cut -d' ' -f1)" = "$sha" ]; then
        die "a copy of the $set key is still readable by $OWNER: $candidate (remove it, then run this again)"
      fi
    done < <(find "/home/$OWNER" /tmp /srv -xdev -type f -size "${size}c" -print0 2>/dev/null)
    ok "no copy of the $set key under /home/$OWNER, /tmp or /srv"
  done < "$tmp/moved"
fi

step "3/6 Install the scorer"
{ printf '#!%s -I\n' "$SYSTEM_PYTHON"; from_main tools/scorer/score.py; } > "$tmp/score"
install -o root -g root -m 0755 "$tmp/score" "$SCORER"
[ -e "$SCORE_LOG" ] || install -o "$KEY_USER" -g "$KEY_USER" -m 0600 /dev/null "$SCORE_LOG"
ok "installed $SCORER (main's tools/scorer/score.py, root's) and the key user's log $SCORE_LOG"

step "4/6 The pipeline's user"
if id "$RUN_USER" >/dev/null 2>&1; then
  ok "$RUN_USER exists"
else
  useradd --system --user-group --home-dir "$RUN_HOME" --create-home --shell /usr/sbin/nologin "$RUN_USER"
  ok "created $RUN_USER"
fi
install -d -o "$RUN_USER" -g "$RUN_USER" -m 0700 "$RUN_HOME"
for group in $(id -nG "$RUN_USER"); do
  [ "$group" = "$RUN_USER" ] || die "$RUN_USER is in the group $group: it must be in its own group alone"
done
KEY_GROUP=$(id -gn "$KEY_USER")
# The drop folder: vxrun's to write, the key user's group's to read (setgid keeps that group).
chown "$RUN_USER:$KEY_GROUP" "$DROP"
chmod 2750 "$DROP"
[ -e "$DROP/.lock" ] || install -m 0640 /dev/null "$DROP/.lock"
chown "$RUN_USER:$KEY_GROUP" "$DROP/.lock"
chmod 0640 "$DROP/.lock"
ok "$DROP is $RUN_USER's to write (2750, group $KEY_GROUP): only $RUN_USER writes the runs it scores"
# The spool: your user fills it for each scored run; vxrun reads it (setgid keeps vxrun's group).
install -d -o "$OWNER" -g "$RUN_USER" -m 2750 "$SPOOL"
ok "$SPOOL is yours to write, $RUN_USER's group's to read"
for file in "${RUNNER_FILES[@]}"; do
  from_main "$file" > "$tmp/installed"
  install -D -o root -g root -m 0644 "$tmp/installed" "$INSTALLED/$file"
done
find "$INSTALLED" -type d -exec chmod 0755 {} +
chown -R root:root "$INSTALLED"
uv=$(as_owner bash -lc 'command -v uv') || die "no uv on $OWNER's PATH to copy"
install -D -o root -g root -m 0755 "$uv" "$BIN/uv"
cat > "$tmp/launcher" <<LAUNCHER
#!$PYTHON -I
# The installed real-drawing command, run as $RUN_USER (scripts/owner/keys-custody.sh, ticket 24s).
import sys

sys.path.insert(0, "$INSTALLED")
from scripts.real_drawings.runner import launch

launch()
LAUNCHER
install -o root -g root -m 0755 "$tmp/launcher" "$RUNNER"
ok "installed main's scripts/real_drawings/ under $INSTALLED, its launcher $RUNNER and uv $("$BIN/uv" --version)"

step "5/6 The rule"
cat > "$tmp/rule" <<RULE
# Installed by scripts/owner/keys-custody.sh (ticket 24s). $OWNER runs, as $RUN_USER and without a
# password, the installed real-drawing command (it checks its own arguments); $RUN_USER runs, as
# $KEY_USER, the poster (it checks its own arguments) and the scorer on exactly one run id.
$OWNER ALL=($RUN_USER) NOPASSWD: $RUNNER
$RUN_USER ALL=($KEY_USER) NOPASSWD: $LIB/post-status, $SCORER ^[0-9A-Za-z-]+\$
RULE
visudo -cf "$tmp/rule" >/dev/null || die "the rule does not validate; nothing was installed"
sed 's/^/    /' "$tmp/rule"
if [ -f "$RULE" ] && cmp -s "$tmp/rule" "$RULE"; then
  ok "$RULE is already this rule"
else
  [ -f "$RULE" ] && cp -a "$RULE" "/root/$(basename "$RULE").bak"
  install -o root -g root -m 0440 "$tmp/rule" "$RULE"
  if ! visudo -c >/dev/null; then
    rm -f -- "$RULE"
    die "sudoers failed to validate with the rule, so it was taken out again. Tell Claude."
  fi
  ok "installed $RULE; sudoers still valid"
fi

step "6/6 Prove the walls"
pass=0; fail=0
check() {
  if eval "$2" >/dev/null 2>&1; then printf '  ok: %s\n' "$1"; pass=$((pass + 1))
  else printf '  FAILED: %s\n' "$1"; fail=$((fail + 1)); fi
}
run_id=20260101T000000Z-000000000000-0000
check "$OWNER cannot list $KEY_DIR" "! sudo -u $OWNER ls $KEY_DIR"
check "$RUN_USER cannot list $KEY_DIR" "! sudo -u $RUN_USER ls $KEY_DIR"
check "$OWNER cannot write $DROP" "! sudo -u $OWNER test -w $DROP"
check "$OWNER cannot change the scorer, the command or its launcher" \
  "! sudo -u $OWNER test -w $SCORER && ! sudo -u $OWNER test -w $RUNNER \
   && ! sudo -u $OWNER test -w $INSTALLED/scripts/real_drawings/command.py"
check "the installed scorer is main's" "cmp -s $tmp/score $SCORER"
check "$OWNER may run the installed command as $RUN_USER (its usage)" \
  "sudo -u $OWNER -- sudo -n -u $RUN_USER $RUNNER --help"
check "$OWNER is refused a shell as $RUN_USER" "! sudo -u $OWNER -- sudo -n -u $RUN_USER /bin/sh -c true"
check "$OWNER is refused root without a password" "! sudo -u $OWNER -- sudo -n true"
# The scorer answers exit code 2 for a run that is not there: it ran, as the key user.
check "$RUN_USER may run the scorer as $KEY_USER on a run id" \
  "sudo -u $RUN_USER -- sudo -n -u $KEY_USER $SCORER $run_id; [ \$? = 2 ]"
check "$RUN_USER may ask the poster, as $KEY_USER, which commit GitHub holds for main" \
  "sudo -u $RUN_USER -- sudo -n -u $KEY_USER $LIB/post-status head main"
check "$RUN_USER is refused the scorer on a path" "! sudo -u $RUN_USER -- sudo -n -u $KEY_USER $SCORER /etc"
check "$RUN_USER is refused a shell as $KEY_USER" \
  "! sudo -u $RUN_USER -- sudo -n -u $KEY_USER /bin/sh -c true"
printf '\n  %s passed, %s failed.\n' "$pass" "$fail"
[ "$fail" = 0 ] || { echo "Something above failed; tell Claude which line."; exit 1; }
echo
echo "Done. main's baseline: scripts/real-drawings main --score (as $OWNER, from the checkout of main)."
