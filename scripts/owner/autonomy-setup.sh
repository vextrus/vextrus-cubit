#!/usr/bin/env bash
# Autonomous sessions' one privilege (ADR 0041; ADR 0026 as amended): the owner's user may run, as the
# key user and without a password, exactly two root-owned programs and nothing else:
#   /usr/local/lib/vextrus/post-status   posts `design-gate` and `real-drawings` through the owner's App
#                                        (installed by scripts/owner/drop-setup.sh)
#   /usr/local/bin/vx-score              the blind scorer (a placeholder from custody-setup.sh until the
#                                        scorer ticket installs the real one at this same path)
# Each program checks its own arguments; the agents' guard allows only these two command lines.
# The App's key and the Answer Keys stay in the key user's home, which no agent can read.
#
# Run once by the owner, as root, in a WSL terminal, after reading this file in full; again whenever it
# changes (it is idempotent: an identical rule is left as it is):
#   cd ~/vextrus-cubit && sudo bash scripts/owner/autonomy-setup.sh
set -euo pipefail

OWNER=riz
KEY_USER=vxkeys
POSTER=/usr/local/lib/vextrus/post-status
SCORER=/usr/local/bin/vx-score
RULE=/etc/sudoers.d/92-vextrus-autonomy

step() { printf '\n== %s\n' "$1"; }
ok() { printf '  ok: %s\n' "$1"; }
warn() { printf '  WARNING: %s\n' "$1"; }
die() { printf '  FAILED: %s\n' "$1"; exit 1; }

step "1/5 Check this machine"
[ "$(id -u)" = 0 ] || die "run this as root: sudo bash scripts/owner/autonomy-setup.sh"
id "$OWNER" >/dev/null 2>&1 || die "no user $OWNER"
id "$KEY_USER" >/dev/null 2>&1 || die "no key user $KEY_USER: run scripts/owner/custody-setup.sh first"
[ "$(stat -c %a "/home/$KEY_USER")" = 700 ] || die "/home/$KEY_USER is not mode 700 (ADR 0026)"
ok "$OWNER and $KEY_USER exist; /home/$KEY_USER is 700"
# The scorer's rule matches its one argument, a run id, by a regular expression (sudo 1.9.10 and later),
# so sudo itself refuses a path or an option: the scorer reads only a run the real-drawing command wrote.
version=$(sudo -V | sed -n 's/^Sudo version \([0-9.]*\).*/\1/p')
printf '%s\n1.9.10\n' "$version" | sort -V -C -r 2>/dev/null \
  || die "sudo $version is older than 1.9.10, which the scorer's argument rule needs"
ok "sudo $version matches arguments by regular expression"

step "2/5 Check what runs is root's and nobody else can change it"
# A program the owner's user could rewrite, or the interpreter it runs under, would let anything running
# as that user act as the key user. Links are followed to what actually runs.
safe_path() {
  local path dir
  [ -e "$1" ] || return 2
  path=$(readlink -f "$1")
  dir=$path
  while [ "$dir" != / ]; do
    [ "$(stat -c %u "$dir")" = 0 ] || { echo "$dir is not root's"; return 1; }
    [ "$(( 0$(stat -c %a "$dir") & 022 ))" = 0 ] || { echo "$dir is group- or world-writable"; return 1; }
    dir=$(dirname "$dir")
  done
}
# The interpreter on a program's first line (through /usr/bin/env, as sudo's secure_path finds it), and,
# for a Python under /opt, its whole tree: the standard library it imports is code that runs too.
interpreter() {
  local first word
  first=$(head -c 256 "$1" | head -n 1)
  [ "${first:0:2}" = "#!" ] || return 0
  read -r word rest <<< "${first:2}"
  if [ "$word" = /usr/bin/env ]; then
    read -r word _ <<< "$rest"
    word=$(PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin command -v "$word")
  fi
  printf '%s\n' "$word"
}
check_program() {
  local program=$1 why code runner tree
  set +e; why=$(safe_path "$program"); code=$?; set -e
  [ "$code" = 0 ] || { echo "$why"; return "$code"; }
  runner=$(interpreter "$program")
  if [ -n "$runner" ]; then
    why=$(safe_path "$runner") || { echo "its interpreter: $why"; return 1; }
    runner=$(readlink -f "$runner")
    case $runner in
      /opt/*)
        tree=$(dirname "$(dirname "$runner")")
        why=$(find "$tree" \( ! -user root -o -perm /022 \) ! -type l -print -quit)
        [ -z "$why" ] || { echo "its interpreter's tree: $why is not root's alone"; return 1; }
        ;;
    esac
  fi
}
for program in "$POSTER" "$SCORER"; do
  set +e; why=$(check_program "$program"); code=$?; set -e
  case $code in
    0) ok "$program, its real target and its interpreter are root's, and only root can change them" ;;
    2) if [ "$program" = "$POSTER" ]; then
         warn "$POSTER is not installed: run scripts/owner/drop-setup.sh (the rule is installed anyway)"
       else
         warn "$SCORER does not exist yet: the rule is for the path the scorer ticket will install"
       fi ;;
    *) die "$why: fix that before any password-free rule names $program" ;;
  esac
done
if [ -x "$SCORER" ] && grep -q "scorer not built yet" "$SCORER" 2>/dev/null; then
  ok "the scorer is still custody-setup.sh's placeholder; the scorer ticket replaces it at $SCORER"
fi

step "3/5 Write the rule and check it with visudo"
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
cat > "$tmp" <<RULE
# Installed by scripts/owner/autonomy-setup.sh (ADR 0041). $OWNER runs, as $KEY_USER and without a
# password, exactly these two programs and nothing else: the poster with any arguments (it checks
# them), the scorer with exactly one run id (a regular expression: a letter or digit first, then
# letters, digits and hyphens, so no path, no option and no second argument).
$OWNER ALL=($KEY_USER) NOPASSWD: $POSTER, $SCORER ^[0-9A-Za-z][0-9A-Za-z-]*\$
RULE
visudo -cf "$tmp" >/dev/null || die "the new rule does not validate; nothing was installed"
ok "the rule validates:"
sed 's/^/    /' "$tmp"

step "4/5 Install it"
if [ -f "$RULE" ] && cmp -s "$tmp" "$RULE"; then
  ok "$RULE is already this rule; left as it is"
else
  [ -f "$RULE" ] && cp -a "$RULE" "/root/$(basename "$RULE").bak" && ok "backed up the old rule in /root/"
  install -o root -g root -m 0440 "$tmp" "$RULE"
  if visudo -c >/dev/null; then
    ok "installed $RULE; sudoers still valid"
  else
    rm -f "$RULE"
    [ -f "/root/$(basename "$RULE").bak" ] && install -o root -g root -m 0440 "/root/$(basename "$RULE").bak" "$RULE"
    die "sudoers failed to validate with the new rule, so it was taken out again. Tell Claude."
  fi
fi

step "5/5 Prove it (each command runs as $OWNER, never asking a password)"
pass=0; fail=0
check() {
  if eval "$2" >/dev/null 2>&1; then printf '  ok: %s\n' "$1"; pass=$((pass + 1))
  else printf '  FAILED: %s\n' "$1"; fail=$((fail + 1)); fi
}
as_owner() { printf 'sudo -u %s -- sudo -n -u %s %s' "$OWNER" "$KEY_USER" "$*"; }
check "$OWNER is refused running id as $KEY_USER" "! $(as_owner id)"
check "$OWNER is refused a shell as $KEY_USER" "! $(as_owner /bin/sh -c true)"
check "$OWNER is refused reading $KEY_USER's home" "! $(as_owner cat /home/$KEY_USER/.profile)"
check "$OWNER is refused root without a password" "! sudo -u $OWNER -- sudo -n true"
check "$OWNER still cannot list /home/$KEY_USER" "! sudo -u $OWNER -- ls /home/$KEY_USER"
if [ -x "$POSTER" ]; then
  check "$OWNER may run post-status as $KEY_USER (its usage)" "$(as_owner "$POSTER" --help)"
else
  warn "post-status is not installed, so its check is skipped: run drop-setup.sh, then this again"
fi
if [ -x "$SCORER" ]; then
  # The placeholder answers 0; the real scorer (ticket 24s) refuses a run that is not there with 2,
  # which proves it ran as the key user (sudo's own refusal is 1).
  check "$OWNER may run the scorer as $KEY_USER on a run id" \
    "$(as_owner "$SCORER" 20260101T000000Z-000000000000-0000); case \$? in 0|2) true ;; *) false ;; esac"
  check "$OWNER is refused the scorer with no run id" "! $(as_owner "$SCORER")"
  check "$OWNER is refused the scorer on a path" "! $(as_owner "$SCORER" /home/$KEY_USER/keys)"
  check "$OWNER is refused the scorer with an option" "! $(as_owner "$SCORER" --key x)"
  check "$OWNER is refused the scorer with a lone option" "! $(as_owner "$SCORER" --help)"
else
  warn "the scorer is not installed yet, so its check is skipped"
fi
printf '\n  %s passed, %s failed.\n' "$pass" "$fail"
printf '  What %s may run as another user now:\n' "$OWNER"
sudo -l -U "$OWNER" | sed 's/^/    /'
[ "$fail" = 0 ] || { echo "Something above failed; tell Claude which line."; exit 1; }
echo
echo "Done. The orchestrator's session (the main checkout) posts gates with the orchestrate-wave skill's line."
