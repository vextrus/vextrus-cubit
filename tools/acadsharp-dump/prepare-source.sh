#!/usr/bin/env bash
# Prepares the source the ACadSharp dumper is built from (ticket W317; ADR 0029): ACadSharp at the
# commit toolchain/acadsharp-source.lock pins (3.8.0's), its CSUtilities submodule at its own pinned
# commit, and the pinned patch (DomCR/ACadSharp#1205's DWG scale repair) applied to the first.
#
#   bash tools/acadsharp-dump/prepare-source.sh --lock <file> --dest <dir> [--patches <dir>]
#        [--origin NAME=URL]...
#
#   --patches  the folder the lock's patch files are in (default: patches/ beside this script)
#   --origin   where NAME is fetched from (defaults: https://github.com/DomCR/<NAME>.git)
#
# Exit 0: --dest/ACadSharp/ holds that repository's files at its commit, patched;
# --dest/CSUtilities/ that repository's files; no .git in either; and --dest/compile.list, the .cs
# files under ACadSharp/src/ACadSharp/, one a line, in byte order. Exit 2: usage, a lock that is not
# well formed, or a --dest that exists and is not an empty folder (nothing is touched). Exit 3:
# refused, with one line on stderr, `prepare-source: refused: <word>: <detail>`, <word> one of
#   fetch        the origin could not be fetched from, or does not have the commit
#   commit       what was fetched is not the commit the lock pins
#   manifest     the commit's files are not the ones the lock pins (below)
#   patch-hash   a patch file is not the one the lock pins by sha256
#   patch-path   a patch names a path that is absolute, holds `..` or lies outside src/ACadSharp/,
#                names two different files in one diff (a move, with or without rename lines),
#                renames or copies a file, makes a link or a submodule, or names a file outside a
#                git diff (PATCH_NAMES below: one parser for every name a patch carries)
#   patch-apply  a patch does not apply cleanly (git apply --check)
# and --dest is left absent or empty.
#
# The manifest of a commit is the sha256 of the text `git ls-files -z | LC_ALL=C sort -z |
# xargs -0 sha256sum` prints in a checkout of it (lines `<hex>  <path>`, paths in byte order),
# leaving out a submodule's entry (its files are the other source's): it pins every byte that is
# built, whatever the origin serves.
#
# Everything happens in a work area beside --dest; nothing is written to --dest until every check
# has passed, and then the result becomes --dest in one rename (never half of it). The work area is
# removed file by file, by name: this script holds no recursive delete. It runs as root in
# scripts/owner/toolchain.sh, inside the root-only build folder, so it reads only its arguments and
# git's own files, and writes only the work area and --dest: no git variable of the caller's is passed
# on, no user's or system's git configuration or attributes file is read, no template, hook,
# submodule or filter is used, git never asks for a password, and an origin must be an https:// or
# file:/// URL. Each repository is fetched by its
# commit alone, one commit deep.
set -euo pipefail

# No git variable of the caller's reaches git (GIT_DIR, GIT_TRACE*, GIT_CONFIG_*, ...): every one is
# unset, then only these are set. No configuration or attributes file of the system or of any home
# is read (core.attributesFile is /dev/null in gitin, below; HOME and XDG_CONFIG_HOME point into the
# work area once it exists).
while IFS= read -r variable; do
  case "$variable" in GIT_*) unset "$variable" ;; esac
done < <(compgen -e)
export GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_SYSTEM=/dev/null GIT_CONFIG_NOSYSTEM=1 GIT_ATTR_NOSYSTEM=1
export GIT_TERMINAL_PROMPT=0 GIT_ALLOW_PROTOCOL=https:file GIT_ASKPASS=/bin/false SSH_ASKPASS=/bin/false
export GIT_NO_REPLACE_OBJECTS=1 LC_ALL=C
umask 022

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
NAMES=(ACadSharp CSUtilities)
LIBRARY=src/ACadSharp/   # the only folder a patch may touch, in ACadSharp's tree

usage() {
  printf 'prepare-source: %s\n' "$1" >&2
  printf 'usage: prepare-source.sh --lock <file> --dest <dir> [--patches <dir>] [--origin NAME=URL]...\n' >&2
  exit 2
}

work=""
refuse() {
  printf 'prepare-source: refused: %s: %s\n' "$1" "$2" >&2
  exit 3
}

# The work area is removed by naming its files, then its emptied folders, never by a recursive delete.
clear_work() {
  if [ -n "$work" ] && [ -d "$work" ] && [ ! -L "$work" ]; then
    find "$work" -xdev -depth ! -type d -exec rm -f -- {} + 2>/dev/null || true
    find "$work" -xdev -depth -type d -exec rmdir -- {} + 2>/dev/null || true
  fi
}
trap clear_work EXIT

# -- arguments ------------------------------------------------------------------------------------
lock="" dest="" patches="$HERE/patches"
declare -A origin=(
  [ACadSharp]=https://github.com/DomCR/ACadSharp.git
  [CSUtilities]=https://github.com/DomCR/CSUtilities.git
)
while [ $# -gt 0 ]; do
  case "$1" in
    --lock) [ $# -ge 2 ] || usage "--lock needs a file"; lock=$2; shift 2 ;;
    --dest) [ $# -ge 2 ] || usage "--dest needs a folder"; dest=$2; shift 2 ;;
    --patches) [ $# -ge 2 ] || usage "--patches needs a folder"; patches=$2; shift 2 ;;
    --origin)
      [ $# -ge 2 ] || usage "--origin needs NAME=URL"
      name=${2%%=*}
      [ "$name" != "$2" ] && [ -n "${2#*=}" ] || usage "--origin needs NAME=URL"
      [ -n "${origin[$name]+set}" ] || usage "--origin names no source: $name"
      case "${2#*=}" in https://?* | file:///*) ;; *) usage "--origin is not an https:// or file:/// URL" ;; esac
      origin[$name]=${2#*=}
      shift 2 ;;
    *) usage "unknown argument: $1" ;;
  esac
done
[ -n "$lock" ] || usage "--lock is required"
[ -n "$dest" ] || usage "--dest is required"
[ -f "$lock" ] || usage "no lock file: $lock"
[ -d "$patches" ] || usage "no patches folder: $patches"
while [ "${dest%/}" != "$dest" ]; do dest=${dest%/}; done
[ -n "$dest" ] || usage "--dest names no new folder"
case "$(basename -- "$dest")" in . | .. | /) usage "--dest names no new folder: $dest" ;; esac
parent=$(dirname -- "$dest")
[ -d "$parent" ] || usage "the folder --dest is in does not exist: $parent"
parent=$(cd "$parent" && pwd)
dest=$parent/$(basename -- "$dest")
if [ -e "$dest" ] || [ -L "$dest" ]; then
  [ -d "$dest" ] && [ ! -L "$dest" ] || usage "--dest exists and is not a folder: $dest"
  [ -z "$(find "$dest" -mindepth 1 -maxdepth 1 -print -quit)" ] || usage "--dest is not empty: $dest"
fi
lock=$(cd "$(dirname -- "$lock")" && pwd)/$(basename -- "$lock")
patches=$(cd "$patches" && pwd)

# -- the lock ---------------------------------------------------------------------------------------
declare -A commit=() manifest=()
patch_names=() patch_hashes=()
while IFS= read -r line || [ -n "$line" ]; do
  line=${line%%#*}
  read -r -a fields <<< "$line"
  [ ${#fields[@]} -gt 0 ] || continue
  case "${fields[0]}" in
    source)
      [ ${#fields[@]} -eq 4 ] || usage "the lock's source record has ${#fields[@]} fields: $line"
      name=${fields[1]}
      [ -n "${origin[$name]+set}" ] || usage "the lock names an unknown source: $name"
      [ -z "${commit[$name]+set}" ] || usage "the lock names $name twice"
      [[ ${fields[2]} =~ ^[0-9a-f]{40}$ ]] || usage "the lock's commit for $name is not 40 hex"
      [[ ${fields[3]} =~ ^[0-9a-f]{64}$ ]] || usage "the lock's manifest for $name is not 64 hex"
      commit[$name]=${fields[2]}
      manifest[$name]=${fields[3]} ;;
    patch)
      [ ${#fields[@]} -eq 3 ] || usage "the lock's patch record has ${#fields[@]} fields: $line"
      [[ ${fields[1]} =~ ^[0-9a-f]{64}$ ]] || usage "the lock's patch hash is not 64 hex"
      [[ ${fields[2]} =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || usage "the lock's patch name is not a plain file name"
      patch_hashes+=("${fields[1]}")
      patch_names+=("${fields[2]}") ;;
    *) usage "the lock has an unknown record: ${fields[0]}" ;;
  esac
done < "$lock"
for name in "${NAMES[@]}"; do
  [ -n "${commit[$name]+set}" ] || usage "the lock does not pin $name"
done

# -- the work area, beside --dest ---------------------------------------------------------------
work=$(mktemp -d "$parent/.prepare-source.XXXXXX")
mkdir "$work/tmp" "$work/templates" "$work/out" "$work/home"
export TMPDIR="$work/tmp" HOME="$work/home" XDG_CONFIG_HOME="$work/home"

gitin() {  # git on one source's repository and work tree in the work area, run from that tree
  local name=$1; shift  # (git apply outside its work tree finds no file)
  ( cd "$work/out/$name" &&
    git --git-dir="$work/$name.git" --work-tree="$work/out/$name" -c core.symlinks=false \
      -c core.attributesFile=/dev/null -c core.fsmonitor=false -c submodule.recurse=false -c protocol.allow=never \
      -c protocol.https.allow=always -c protocol.file.allow=always "$@" )
}

# -- 1. the patches: each is its pin, and touches only the library's own files ------------------
for i in "${!patch_names[@]}"; do
  file="$patches/${patch_names[$i]}"
  [ -f "$file" ] && [ ! -L "$file" ] || refuse patch-hash "${patch_names[$i]} is not a file in the patches folder"
  # Copied first, then the copy hashed: what is applied is the very bytes that were checked.
  cp -- "$file" "$work/patch-$i"
  digest=$(sha256sum < "$work/patch-$i" | cut -d' ' -f1)
  [ "$digest" = "${patch_hashes[$i]}" ] || refuse patch-hash "${patch_names[$i]} is not the patch the lock pins"
done

# The names a patch carries, one a line on stdout: `name<TAB><path>` for each file's path, or a
# single `refuse<TAB><why>`. The rule: each file is a git diff (`diff --git a/P b/P`, the same P
# twice); its `---` names a/P or /dev/null and its `+++` b/P or /dev/null; no rename or copy; every
# mode line and index line is exactly one file's mode (100644 or 100755), never a link's, a
# submodule's or a second number git would read first; and no `---` or `+++` line
# stands outside a git diff (a traditional patch's names are refused, not interpreted). Text before
# the first diff (a provenance header) is read as git reads it: ignored, unless it names a file.
# Each P is then checked to lie under src/ACadSharp/ (inside_library).
PATCH_NAMES='
function fail(why) { print "refuse\t" why; failed = 1; exit }
function count(range) { return index(range, ",") ? substr(range, index(range, ",") + 1) + 0 : 1 }
{
  line = $0
  if (old > 0 || new > 0) {
    c = substr(line, 1, 1)
    if (c == "\\") next
    if (c == "-") old--
    else if (c == "+") new--
    else if (c == " " || line == "") { old--; new-- }
    else fail("has a hunk shorter than its header")
    if (old < 0 || new < 0) fail("has a hunk longer than its header")
    next
  }
  if (substr(line, 1, 11) == "diff --git ") {
    rest = substr(line, 12); n = length(rest)
    if (n < 7 || n % 2 == 0) fail("names two different files in one diff")
    path = substr(rest, 3, (n - 5) / 2)
    if (rest != "a/" path " b/" path) fail("names two different files in one diff")
    files++; minus = ""; plus = ""
    print "name\t" path
    next
  }
  if (substr(line, 1, 4) == "--- " || substr(line, 1, 4) == "+++ ") {
    if (!files) fail("names a file outside a git diff")
    named = substr(line, 5)
    if (index(named, "\t")) named = substr(named, 1, index(named, "\t") - 1)
    side = substr(line, 1, 1) == "-" ? "a/" : "b/"
    if (named != "/dev/null" && named != side path) fail("names two different files in one diff")
    if (side == "a/") minus = named; else plus = named
    next
  }
  if (substr(line, 1, 3) == "@@ ") {
    if (!files || minus == "" || plus == "") fail("has a hunk before its file is named")
    if (line !~ /^@@ -[0-9]+(,[0-9]+)? \+[0-9]+(,[0-9]+)? @@/) fail("has a hunk header git cannot read")
    split(line, part, " ")
    old = count(part[2]); new = count(part[3])
    next
  }
  if (!files) next
  if (line ~ /^(rename|copy) /) fail("renames or copies a file")
  if (line ~ /^(old mode|new mode|new file mode|deleted file mode|index) /) {
    if (line !~ /^(old mode|new mode|new file mode|deleted file mode) 100(644|755)$/ &&
        line !~ /^index [0-9a-f]+\.\.[0-9a-f]+( 100(644|755))?$/) fail("makes a link or a submodule")
  }
}
END {
  if (failed) exit
  if (old > 0 || new > 0) fail("ends inside a hunk")
}
'

inside_library() {
  case "$1" in "" | /* | *\\*) return 1 ;; esac
  case "/$1/" in */../* | */./* | *//*) return 1 ;; esac
  case "$1" in "$LIBRARY"?*) return 0 ;; esac
  return 1
}

# -- 2. each source: fetched by its commit, checked, checked out without its .git -----------------
for name in "${NAMES[@]}"; do
  git init -q --bare --template="$work/templates" "$work/$name.git" ||
    refuse fetch "$name: could not make a repository to fetch into"
  mkdir "$work/out/$name"
  gitin "$name" fetch -q --depth 1 --no-tags --no-recurse-submodules --no-write-fetch-head \
    -- "${origin[$name]}" "${commit[$name]}" 2> "$work/tmp/fetch.log" ||
    refuse fetch "$name: the origin did not give commit ${commit[$name]} ($(tail -n 1 "$work/tmp/fetch.log" | tr -cd '[:print:]' | cut -c1-200))"
  gitin "$name" rev-parse -q --verify "${commit[$name]}^{commit}" > /dev/null 2>&1 ||
    refuse commit "$name: commit ${commit[$name]} is not in what was fetched"
  gitin "$name" checkout -q --detach "${commit[$name]}" 2> "$work/tmp/checkout.log" ||
    refuse commit "$name: commit ${commit[$name]} could not be checked out"
  head=$(gitin "$name" rev-parse HEAD)
  [ "$head" = "${commit[$name]}" ] || refuse commit "$name: checked out $head, not ${commit[$name]}"
  got=$(cd "$work/out/$name" &&
        gitin "$name" ls-files -z --stage |
        while IFS= read -r -d '' entry; do
          [ "${entry%% *}" = 160000 ] || printf '%s\0' "${entry#*$'\t'}"
        done | sort -z | xargs -0 -r sha256sum -- | sha256sum | cut -d' ' -f1) ||
    refuse manifest "$name at ${commit[$name]}: its files could not be hashed"
  [ "$got" = "${manifest[$name]}" ] || refuse manifest "$name at ${commit[$name]} is not the tree the lock pins"
done

# -- 3. the patches' paths, as git itself reads them, then a check that each applies ------------
for i in "${!patch_names[@]}"; do
  # One parser reads every name the patch carries, as git apply reads them (hunks by their line
  # counts, so a removed line that starts "-- " is content, never a name), and one rule judges them.
  names=0
  while IFS=$'\t' read -r kind value; do
    case "$kind" in
      name) inside_library "$value" ||
              refuse patch-path "${patch_names[$i]} touches a path outside $LIBRARY"
            names=$((names + 1)) ;;
      refuse) refuse patch-path "${patch_names[$i]} $value" ;;
      *) refuse patch-path "${patch_names[$i]} could not be read for its names" ;;
    esac
  done < <(awk "$PATCH_NAMES" "$work/patch-$i" || printf 'refuse\tcould not be read for its names\n')
  [ "$names" -gt 0 ] || refuse patch-path "${patch_names[$i]} touches no file"
  gitin ACadSharp apply --check "$work/patch-$i" 2> /dev/null ||
    refuse patch-apply "${patch_names[$i]} does not apply to ACadSharp at ${commit[ACadSharp]}"
  # Applied to the work tree only, never to the index, so a later patch is checked against the
  # tree as patched so far.
  gitin ACadSharp apply "$work/patch-$i" 2> /dev/null ||
    refuse patch-apply "${patch_names[$i]} does not apply to ACadSharp at ${commit[ACadSharp]}"
done

# -- 4. the list of ACadSharp's own sources, in byte order ----------------------------------------
# What its project compiles (every .cs under src/ACadSharp/), named in an order no file system
# chooses: MSBuild's `**` lists files in the order the folder gives them, and the compiler's output
# follows the order of its sources, so a glob could build other bytes in another folder.
( cd "$work/out/ACadSharp" && find "$LIBRARY" -type f -name '*.cs' -print0 | sort -z | tr '\0' '\n' ) \
  > "$work/out/compile.list"

# -- 5. every check passed: the two trees and the list become --dest in one rename --------------
# The work area is beside --dest, on its file system, so the rename is whole or not at all: --dest
# never holds part of the result. An empty --dest is removed first (rmdir removes only an empty one).
if [ -d "$dest" ]; then rmdir -- "$dest"; fi
mv -T -- "$work/out" "$dest"
