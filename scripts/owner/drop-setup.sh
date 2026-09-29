#!/usr/bin/env bash
# The real-drawing check's drop folder and the poster (the M0 plan, "The baseline"; ADRs 0026, 0030).
# Run once by the owner in a WSL terminal, from the checkout of main, after reading
# scripts/owner/post-status and scripts/owner/post-status.toml in full; again whenever either changes:
#   cd ~/vextrus-cubit && bash scripts/owner/drop-setup.sh
# sudo asks your password. It makes:
#   /srv/vextrus-drop         yours to write, the key user's group may read (setgid, so each run's
#                             folder and files keep that group); one folder per posting run
#   /srv/vextrus-drop/.lock   the lock one posting run at a time holds
#   /usr/local/lib/vextrus/post-status and post-status.toml
#                             the poster and its settings, root's: the key user runs them, and nothing
#                             running as you (an agent included) can change what the key user runs
# It never reads the App's key; it only checks that the key user can.
#
# Once scripts/owner/keys-custody.sh has made the pipeline's user (ticket 24s), that script owns the
# drop folder and installs the poster from GitHub's main; this one then refuses, so it can never hand the
# drop folder back to you or install a poster from your working tree.
#
# Everything runs inside `main`, which bash reads whole first: a change to this file while it waits at
# its prompt is never read.
set -euo pipefail

main() {
  root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
  config=$root/scripts/owner/post-status.toml
  setting() {
    python3 -c 'import sys, tomllib; print(tomllib.load(open(sys.argv[1], "rb"))[sys.argv[2]])' "$config" "$1"
  }
  KEY_USER=$(setting key_user)
  KEY=$(setting key)
  DROP=$(setting drop)
  INSTALLED=$(setting installed)
  ME=$(id -un)
  GROUP=$(id -gn "$KEY_USER")
  # Named here, not read from the settings, which your working tree holds.
  if id vxrun >/dev/null 2>&1; then
    echo "The pipeline's user exists: scripts/owner/keys-custody.sh now owns $DROP and installs the"
    echo "poster from GitHub's main. Run that instead (sudo bash scripts/owner/keys-custody.sh)."
    exit 1
  fi

  echo "Drop folder: $DROP (yours; group $GROUP may read)"
  echo "Poster:      $INSTALLED (root's; run as $KEY_USER)"
  read -r -p "Go on? [y/N] " reply
  [[ "$reply" =~ ^[Yy] ]] || { echo "Nothing changed."; exit 0; }

  sudo install -d -o "$ME" -g "$GROUP" -m 2750 "$DROP"
  [ -e "$DROP/.lock" ] || install -m 0640 /dev/null "$DROP/.lock"
  sudo install -d -o root -g root -m 0755 "$(dirname "$INSTALLED")"
  sudo install -o root -g root -m 0755 "$root/scripts/owner/post-status" "$INSTALLED"
  sudo install -o root -g root -m 0644 "$config" "$INSTALLED.toml"

  echo
  echo "Checking:"
  fail=0
  check() {
    if eval "$2" >/dev/null 2>&1; then echo "  ✓ $1"; else echo "  ✗ $1"; fail=1; fi
  }
  check "$DROP is yours, mode 2750, group $GROUP" "[ \"\$(stat -c '%U %a %G' '$DROP')\" = '$ME 2750 $GROUP' ]"
  check "you can take the lock" "flock -n '$DROP/.lock' true"
  check "the key user can read the drop folder" "sudo -u '$KEY_USER' test -r '$DROP/.lock'"
  check "the installed poster is the checkout's" "cmp -s '$root/scripts/owner/post-status' '$INSTALLED'"
  check "you cannot change the installed poster" "[ ! -w '$INSTALLED' ] && [ ! -w '$INSTALLED.toml' ]"
  check "the key user can read the App's key (not read here)" "sudo -u '$KEY_USER' test -r '$KEY'"
  check "openssl is installed (the poster signs with it)" "command -v openssl"
  check "the poster's Python is installed" "[ -x \"\$(head -1 '$INSTALLED' | cut -c3- | cut -d' ' -f1)\" ]"
  echo
  if [ "$fail" = 0 ]; then
    echo "Done. Next: scripts/real-drawings main (the baseline), once 04 and 06b are merged."
  else
    echo "Something above failed; tell Claude which line."
    exit 1
  fi
}

# The call and the exit are one compound, parsed whole: nothing after them is ever read.
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
  exit
fi
