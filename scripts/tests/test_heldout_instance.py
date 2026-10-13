"""scripts/owner/heldout-instance.sh and heldout-roles.sql (ticket M1-06), which the owner runs as root.

Nothing here raises privilege. The script is parsed, shellchecked and run in its dry-run mode as the
test's user; its functions are sourced and called with the users' switches stubbed to the test's user.
The walls themselves are proved on a throwaway PostgreSQL cluster this test makes as its own user (a
superuser there, nowhere else): the SQL is run for real, the script puts its pg_hba.conf block in, and
the owner's roles (`vextrus`, `vextrus_app`, the owner's own, the superuser) are refused the Held-out
database with passwords that work everywhere else. A build session's refusals are proved through the
guard's own test seam (guard.mjs fed a tool call on stdin) and settings.json, with no change to either.
"""

import json
import os
import re
import shutil
import socket
import subprocess
import time
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[2]
SCRIPT = REPO / "scripts" / "owner" / "heldout-instance.sh"
ROLES_SQL = REPO / "scripts" / "owner" / "heldout-roles.sql"
GUARD = REPO / ".claude" / "hooks" / "guard.mjs"
SETTINGS = REPO / ".claude" / "settings.json"
DB = "vextrus_heldout"
HELD = ("vextrus_heldout", "vextrus_heldout_app")

# As the test's user: the script's functions, with install dropping its owner flags (only root may give a
# file away) and every switch of user running as this one.
STUBS = """
install() {
  local args=()
  while (($#)); do case $1 in -o|-g) shift 2 ;; *) args+=("$1"); shift ;; esac; done
  command install "${args[@]}"
}
as_owner() { "$@"; }
as_key() { "$@"; }
as_postgres() { "$@"; }
"""


def sourced(
    body: str, env: dict[str, str] | None = None, answer: str = ""
) -> subprocess.CompletedProcess[str]:
    """Runs `body` in bash after sourcing the script and the stubs; `answer` is its stdin."""
    script = f"source {SCRIPT}\n{STUBS}\n{body}\n"
    return subprocess.run(
        ["bash", "-c", script], input=answer, capture_output=True, text=True, check=False, env=env
    )


def variable(name: str) -> str:
    done = sourced(f'printf "%s" "${name}"')
    assert done.returncode == 0, done.stderr
    return done.stdout


# ------------------------------------------------------------------------------------- the script itself


def test_the_script_parses() -> None:
    done = subprocess.run(["bash", "-n", str(SCRIPT)], capture_output=True, text=True, check=False)
    assert done.returncode == 0, done.stderr


@pytest.mark.skipif(shutil.which("shellcheck") is None, reason="no shellcheck here")
def test_shellcheck_finds_nothing() -> None:
    done = subprocess.run(["shellcheck", str(SCRIPT)], capture_output=True, text=True, check=False)
    assert done.returncode == 0, done.stdout


def test_every_step_runs_inside_main_which_runs_only_when_the_file_is_run() -> None:
    # Bash reads main whole before running it, so a change your user makes to the file while root waits
    # at a prompt is never run (keys-custody.sh's rule, tools/scorer/tests/test_custody.py).
    text = SCRIPT.read_text()
    start = text.index("\nmain() {\n")
    end = text.index("\n}\n", start)
    assert text[end + 3 :] == (
        "\n# Only when run, never when sourced (the tests source this file to call its functions as"
        " your user).\n"
        'if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then\n  main "$@"\n  exit\nfi\n'
    )
    before = text[:start]
    for line in before.splitlines():
        assert not line.startswith(
            ("step ", "read ", "confirm ", "install ", "chown ", "chmod ", "rm ", "mv ", "runuser ")
        ), line


def fake_bin(tmp_path: Path) -> tuple[Path, Path]:
    """A PATH folder whose every command that could change something only records that it ran."""
    folder = tmp_path / "bin"
    folder.mkdir()
    marker = tmp_path / "ran"
    for name in (
        "runuser", "sudo", "su", "psql", "install", "git", "curl", "openssl", "tar", "chown", "chmod",
        "mv", "rm", "mktemp", "npm", "node", "uv", "useradd", "pg_ctlcluster", "systemctl", "tee",
        "python3",
    ):  # fmt: skip
        tool = folder / name
        tool.write_text(f'#!/bin/sh\necho "{name} $*" >> "{marker}"\nexit 0\n')
        tool.chmod(0o755)
    return folder, marker


def test_the_dry_run_prints_every_step_and_runs_nothing(tmp_path: Path) -> None:
    folder, marker = fake_bin(tmp_path)
    env = {"PATH": f"{folder}:/usr/bin:/bin", "HOME": str(tmp_path)}
    done = subprocess.run(
        ["bash", str(SCRIPT), "--dry-run"], capture_output=True, text=True, env=env, check=False
    )
    assert done.returncode == 0, done.stdout + done.stderr
    for number in range(1, 8):
        assert f"== {number}/7 " in done.stdout
    assert "Dry run done: nothing ran." in done.stdout
    assert not marker.exists(), marker.read_text()
    # Each wall it will build and prove is named, with the database, roles and the block's rules.
    for words in (
        "CONNECT revoked from PUBLIC",
        f"database {DB}, its owner vextrus_heldout",
        "host    vextrus_heldout  vextrus_heldout,vextrus_heldout_app  127.0.0.1/32  scram-sha-256",
        "PostgreSQL 18",
        "cannot reach vextrus_heldout as vextrus, vextrus_app",
    ):
        assert words in done.stdout, words
    assert "5544" in done.stdout
    assert "never touched" in done.stdout


def test_it_refuses_an_unknown_argument_and_runs_only_as_root(tmp_path: Path) -> None:
    folder, marker = fake_bin(tmp_path)
    env = {"PATH": f"{folder}:/usr/bin:/bin", "HOME": str(tmp_path)}
    unknown = subprocess.run(
        ["bash", str(SCRIPT), "--yes"], capture_output=True, text=True, env=env, check=False
    )
    assert unknown.returncode != 0
    assert "unknown argument" in unknown.stdout
    if os.geteuid() != 0:
        not_root = subprocess.run(
            ["bash", str(SCRIPT)], capture_output=True, text=True, env=env, check=False
        )
        assert not_root.returncode != 0
        assert "run this as root" in not_root.stdout
    assert not marker.exists()


def test_every_place_of_the_instance_is_under_the_key_users_home() -> None:
    home = variable("KEY_HOME")
    assert home == f"/home/{variable('KEY_USER')}"
    for name in ("INSTANCE", "APP", "STORE", "LOGS", "SETTINGS", "JEV_KEY", "SERVE", "KEY_PGPASS"):
        assert variable(name).startswith(home + "/"), name
    settings = sourced('instance_settings "not-a-real-key"').stdout
    assert f"VEXTRUS_STORAGE_ROOT={variable('STORE')}" in settings
    assert f"VEXTRUS_DB_NAME={DB}" in settings
    assert "VEXTRUS_APP_ROLE=vextrus_heldout_app" in settings
    assert "VEXTRUS_OWNER_ROLE=vextrus_heldout" in settings
    serve = sourced("serve_script").stdout
    assert f'>> "{variable("LOGS")}/$name.log"' in serve
    assert f"$(cat {variable('JEV_KEY')})" in serve


def test_the_key_users_files_are_made_its_alone() -> None:
    text = SCRIPT.read_text()
    # Every folder and file the script puts under the key user's home is the key user's, 700 or 600 (the
    # launcher is root's, so the key user runs it unchanged); the home itself must already be 700.
    for target in ('"$INSTANCE" "$APP"', '"$INSTANCE" "$STORE" "$LOGS"'):
        assert f'install -d -o "$KEY_USER" -g "$KEY_USER" -m 0700 {target}' in text
    for target in ('"$KEY_PGPASS"', '"$SETTINGS"', '"$JEV_KEY"', '"$LOGS/setup.log"'):
        made = rf'install -o "\$KEY_USER" -g "\$KEY_USER" -m 0600 "\$tmp/[\w.]+" {re.escape(target)}'
        assert re.search(made, text), target
    assert 'install -o root -g root -m 0755 "$tmp/serve" "$SERVE"' in text
    assert '= "$KEY_USER 700" ]' in text


def test_no_secret_is_ever_an_argument_or_shown() -> None:
    text = SCRIPT.read_text()
    # The passwords and the Jev key pass through bash's own printf into a pipe or a root-only file, never
    # as an argument of another program (which any user could list), and are never echoed.
    assert "printf '%s' \"$password\" | scram_verifier" in text
    assert "printf '%s' \"$password\" | pgpass_with" in text
    assert 'printf \'%s\' "$jev" > "$tmp/jev"' in text
    assert "printf '%s\\n' \"$demo\" | as_key bash -c 'IFS= read -r VEXTRUS_DEMO_PASSWORD;" in text
    assert text.count("read -r -s -p") == 2
    secrets = ('"$password"', '"$jev"', '"$secret"', '"$demo"')
    for line in text.splitlines():
        code = line.split(" #")[0]
        if any(secret in code for secret in secrets):
            # bash's own printf, into a pipe or a file; or the settings, written into a root-only file
            # (`[` is bash's own too)
            assert "printf '%s" in code or code.lstrip().startswith(
                ("instance_settings ", "if [ -n ", "[ -n ")
            ), line
    # The proof that the owner cannot act as the key user asks sudo's rule, never the password the owner
    # just typed for this script (cached for that terminal).
    assert '"! as_owner sudo -n -k -u $KEY_USER true"' in text
    # Nothing secret reaches the key user's processes through an argument or the debug pages.
    assert "VEXTRUS_DEBUG" not in sourced("serve_script").stdout.replace("Never VEXTRUS_DEBUG", "")


# --------------------------------------------------------------------------------------- its functions


def _git(*args: str, cwd: Path) -> None:
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True)


def test_roots_git_never_reads_the_owners_checkout_or_home(tmp_path: Path) -> None:
    # The refuter of M1-06 (80): root's `git ls-remote` ran inside the owner's checkout, whose
    # .git/config (url.insteadOf) swapped GitHub's answer for a commit the owner's user chose.
    planted = tmp_path / "planted.git"
    planted.mkdir()
    _git("init", "--quiet", "--bare", cwd=planted)
    work = tmp_path / "work"
    work.mkdir()
    _git("init", "--quiet", "-b", "main", cwd=work)
    _git(
        "-c",
        "user.name=t",
        "-c",
        "user.email=t@t",
        "commit",
        "--quiet",
        "--allow-empty",
        "-m",
        "x",
        cwd=work,
    )
    _git("push", "--quiet", str(planted), "main", cwd=work)
    url = f"file://{tmp_path}/nowhere/vextrus-cubit.git"  # not there: fails at once
    for config in (work / ".git" / "config", tmp_path / ".gitconfig"):
        with config.open("a") as file:
            file.write(f'[url "{planted}"]\n\tinsteadOf = {url}\n')
    body = f"cd {work}; git ls-remote {url} refs/heads/main"
    env = {"PATH": os.environ["PATH"], "HOME": str(tmp_path)}
    control = sourced(body, env=env)
    assert control.returncode == 0  # the plant works on a plain git...
    assert "refs/heads/main" in control.stdout
    clean = sourced(f"cd {work}; as_root_clean git ls-remote {url} refs/heads/main", env=env)
    assert clean.returncode != 0  # ...and root's git never reads it
    assert "refs/heads/main" not in clean.stdout
    text = SCRIPT.read_text()
    assert "as_root_clean git ls-remote" in text
    assert "as_root_clean curl -q " in text
    assert len(re.findall(r"^\s*(?:github_main=\$\()?(?:git|curl) ", text, re.M)) == 0


def routes(
    tmp_path: Path, groups: str, answer: str, interop: str | None, drive: Path | None = None
) -> subprocess.CompletedProcess[str]:
    binfmt = tmp_path / "binfmt"
    binfmt.mkdir(parents=True, exist_ok=True)
    if interop is not None:
        (binfmt / "WSLInterop").write_text(f"{interop}\ninterpreter /init\n")
    mounts = tmp_path / "mounts"
    lines = ["none /usr/lib/wsl/drivers 9p ro 0 0", "/dev/sdc / ext4 rw 0 0"]
    if drive is not None:
        lines.append(f"C:\\134 {drive} 9p rw 0 0")
    mounts.write_text("\n".join(lines) + "\n")
    body = (
        f'BINFMT={binfmt}; MOUNTS={mounts}; OWNER=someone; id() {{ echo "{groups}"; }};'
        " root_routes && echo PASSED"
    )
    return sourced(body, answer=answer)


def test_a_writable_windows_drive_stops_the_script_unless_the_owner_accepts_it(tmp_path: Path) -> None:
    # The refuter of M1-06, round 2 (55): with interop off, a file the owner's user drops in Windows'
    # Startup folder on a writable drive still runs wsl -u root at the next Windows sign-in.
    drive = tmp_path / "c"
    drive.mkdir()
    stopped = routes(tmp_path, "someone users", "n\n", None, drive)
    assert stopped.returncode != 0
    assert "stopped at the writable Windows drives" in stopped.stdout
    assert str(drive) in stopped.stdout
    assert "PASSED" in routes(tmp_path, "someone users", "y\n", None, drive).stdout
    drive.chmod(0o555)
    try:
        if not os.access(drive, os.W_OK):  # (root writes anything)
            assert "PASSED" in routes(tmp_path, "someone users", "", None, drive).stdout
    finally:
        drive.chmod(0o755)


def test_wsl_interop_stops_the_script_unless_the_owner_accepts_it(tmp_path: Path) -> None:
    # The refuter of M1-06 (80): with interop on, any process of the owner's user runs wsl.exe -u root.
    stopped = routes(tmp_path, "someone users", "n\n", "enabled")
    assert stopped.returncode != 0
    assert "stopped at WSL interop" in stopped.stdout
    accepted = routes(tmp_path, "someone users", "y\n", "enabled")
    assert "PASSED" in accepted.stdout
    assert "PASSED" in routes(tmp_path / "off", "someone users", "", "disabled").stdout


def test_the_docker_group_stops_the_script_unless_the_owner_accepts_it(tmp_path: Path) -> None:
    stopped = routes(tmp_path, "someone docker users", "n\n", None)
    assert stopped.returncode != 0
    assert "stopped at the docker group" in stopped.stdout
    assert "PASSED" in routes(tmp_path, "someone docker", "y\n", None).stdout
    assert "PASSED" in routes(tmp_path, "someone users", "", None).stdout


def test_the_launcher_refuses_a_taken_port_and_says_to_keep_the_sign_in_apart() -> None:
    serve = sourced("serve_script").stdout
    assert '(exec 3<>"/dev/tcp/127.0.0.1/$port")' in serve
    assert "for port in 8300 5300; do" in serve
    assert "a browser profile of its own" in serve


def test_root_runs_only_roots_programs_and_never_from_the_key_users_home() -> None:
    # The refuter, round 2: root's PATH was the one it started with (sudo -E keeps the owner's), and
    # step 7's refusals ran from the key user's home (a refusal there could be the folder's).
    text = SCRIPT.read_text()
    main = text[text.index("\nmain() {\n") :]
    assert main.index("export PATH=$CLEAN_PATH") < main.index('step "1/7')
    assert main.index("cd /") < main.index('step "1/7')
    assert 'cd -- "$INSTANCE"' not in text
    assert variable("CLEAN_PATH").split(":") == [
        "/usr/local/sbin", "/usr/local/bin", "/usr/sbin", "/usr/bin", "/sbin", "/bin",
    ]  # fmt: skip


HBA = """# PostgreSQL Client Authentication Configuration File
# TYPE  DATABASE  USER  ADDRESS  METHOD

local   all   postgres   peer
local   all   all        peer
host    all   all   127.0.0.1/32   scram-sha-256
host    all   all   ::1/128        scram-sha-256
"""


def with_block(tmp_path: Path, text: str) -> subprocess.CompletedProcess[str]:
    hba = tmp_path / "pg_hba.conf"
    hba.write_text(text)
    return sourced(f'hba_with_block "{hba}"')


def test_the_block_goes_before_every_other_rule_and_comments_stay(tmp_path: Path) -> None:
    done = with_block(tmp_path, HBA)
    assert done.returncode == 0, done.stderr
    lines = done.stdout.splitlines()
    rules = [line for line in lines if line.strip() and not line.lstrip().startswith("#")]
    assert rules[:3] == [
        "host    vextrus_heldout  vextrus_heldout,vextrus_heldout_app  127.0.0.1/32  scram-sha-256",
        "host    vextrus_heldout  all                                  all           reject",
        "local   vextrus_heldout  all                                                reject",
    ]
    assert rules[3:] == [line for line in HBA.splitlines() if line and not line.startswith("#")]
    assert lines[:3] == HBA.splitlines()[:3]


def test_putting_the_block_in_twice_leaves_one_block(tmp_path: Path) -> None:
    once = with_block(tmp_path, HBA).stdout
    twice = with_block(tmp_path, once).stdout
    assert twice == once
    assert twice.count(">>> vextrus-heldout") == 1


def test_an_older_block_is_replaced_wherever_it_was(tmp_path: Path) -> None:
    begin = variable("HBA_BEGIN")
    old = HBA + f"{begin}\nhost vextrus_heldout all 0.0.0.0/0 trust\n# <<< vextrus-heldout\n"
    done = with_block(tmp_path, old)
    assert done.returncode == 0
    assert "trust" not in done.stdout
    assert done.stdout.count(begin) == 1


def test_a_block_with_no_end_is_refused(tmp_path: Path) -> None:
    done = with_block(tmp_path, HBA + variable("HBA_BEGIN") + "\nhost all all all trust\n")
    assert done.returncode != 0


def test_a_file_with_no_rule_gets_the_block_at_its_end(tmp_path: Path) -> None:
    done = with_block(tmp_path, "# nothing yet\n")
    assert done.stdout.startswith("# nothing yet\n# >>> vextrus-heldout")


def test_the_pgpass_line_of_each_role_is_set_and_no_other_line_changes(tmp_path: Path) -> None:
    pgpass = tmp_path / "pgpass"
    keep = [
        "127.0.0.1:5432:vextrus_heldout:vextrus_heldout:aaaa",
        "127.0.0.1:5432:other:vextrus_heldout_app:bbbb",
        "127.0.0.1:5432:*:somebody:cccc",
        "127.0.0.1:5432:vextrus_heldout:vextrus_heldout_appx:dddd",
    ]
    pgpass.write_text(
        "\n".join([*keep, "127.0.0.1:5432:vextrus_heldout:vextrus_heldout_app:old"]) + "\n"
    )
    done = sourced(f'printf "%s" new | pgpass_with "{pgpass}" vextrus_heldout_app')
    assert done.returncode == 0, done.stderr
    assert done.stdout.splitlines() == [*keep, "127.0.0.1:5432:vextrus_heldout:vextrus_heldout_app:new"]
    fresh = sourced(f'printf "%s" new | pgpass_with "{tmp_path / "none"}" vextrus_heldout')
    assert fresh.stdout == "127.0.0.1:5432:vextrus_heldout:vextrus_heldout:new\n"


def test_the_scram_verifier_has_postgresqls_form_and_a_fresh_salt_each_time() -> None:
    one = sourced("printf '%s' secret | scram_verifier").stdout.strip()
    two = sourced("printf '%s' secret | scram_verifier").stdout.strip()
    assert one.startswith("SCRAM-SHA-256$4096:")
    assert two.startswith("SCRAM-SHA-256$4096:")
    assert one != two
    salted = sourced("printf '%s' secret | scram_verifier c2FsdHNhbHRzYWx0c2FsdA==").stdout
    again = sourced("printf '%s' secret | scram_verifier c2FsdHNhbHRzYWx0c2FsdA==").stdout
    assert salted == again


# ------------------------------------------------------------------------------------------- the SQL


def test_the_sql_names_the_ticket_s_database_and_roles_and_revokes_connect() -> None:
    sql = ROLES_SQL.read_text()
    assert "\\set ON_ERROR_STOP on" in sql
    for role in HELD:
        assert (
            f"ALTER ROLE {role:<19} LOGIN NOCREATEDB NOSUPERUSER NOCREATEROLE NOREPLICATION NOBYPASSRLS;"
            in sql
        )
    assert "CREATE DATABASE vextrus_heldout OWNER vextrus_heldout" in sql
    assert "REVOKE ALL ON DATABASE vextrus_heldout FROM PUBLIC;" in sql
    assert "GRANT CONNECT, TEMPORARY ON DATABASE vextrus_heldout TO vextrus_heldout_app;" in sql
    assert not [
        line
        for line in sql.splitlines()
        if "PASSWORD" in line.upper() and not line.lstrip().startswith("--")
    ]
    for line in sql.splitlines():
        if "GRANT" in line and not line.startswith("--"):
            assert "vextrus_app" not in line.replace("vextrus_heldout_app", "")


# ------------------------------------------------------------------------- the walls, on a real cluster


def _binaries() -> Path | None:
    for major in ("18", "17", "16"):
        folder = Path(f"/usr/lib/postgresql/{major}/bin")
        if (folder / "initdb").exists() and (folder / "pg_ctl").exists():
            return folder
    return None


BINARIES = _binaries()
needs_postgres = pytest.mark.skipif(
    BINARIES is None or shutil.which("psql") is None, reason="no PostgreSQL server binaries here"
)
PASSWORD = "the-owners-password-for-every-m0-role"


@dataclass
class Cluster:
    data: Path
    socket: Path
    port: int
    log: Path
    pgpass: Path  # the owner's: a working password for every M0 role and the superuser
    key_pgpass: Path  # the key user's, which the script fills
    owner_role: str

    def psql(
        self, sql: str, *, user: str = "postgres", db: str = "postgres", host: str | None = None,
        pgpass: Path | None = None,
    ) -> subprocess.CompletedProcess[str]:  # fmt: skip
        env = {
            "PATH": os.environ["PATH"],
            "PGPASSFILE": str(pgpass or self.pgpass),
            "PGCONNECT_TIMEOUT": "5",
        }
        return subprocess.run(
            ["psql", "-X", "-w", "-At", "-v", "ON_ERROR_STOP=1", "-h", host or str(self.socket),
             "-p", str(self.port), "-U", user, "-d", db, "-c", sql],
            capture_output=True, text=True, env=env, check=False,
        )  # fmt: skip

    def script(self, body: str, answer: str = "") -> subprocess.CompletedProcess[str]:
        """`body` after sourcing the script, its places and switches moved onto this cluster."""
        places = (
            f"PORT={self.port}; KEY_PGPASS={self.key_pgpass}; tmp={self.data.parent / 'tmp'};"
            f' super_psql() {{ psql -X -q -v ON_ERROR_STOP=1 -h "{self.socket}" -p "$PORT"'
            ' -U postgres -d postgres "$@"; }'
        )
        env = {"PATH": os.environ["PATH"], "HOME": "/nonexistent"}
        return sourced(f"{places}\n{body}", env=env, answer=answer)


def _free_port() -> int:
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


@pytest.fixture(scope="module")
def cluster(tmp_path_factory: pytest.TempPathFactory) -> Iterator[Cluster]:
    assert BINARIES is not None
    root = tmp_path_factory.mktemp("heldout-cluster")
    data, sock, tmp = root / "data", root / "socket", root / "tmp"
    sock.mkdir()
    tmp.mkdir(mode=0o700)
    pwfile = root / "superuser-password"
    pwfile.write_text(PASSWORD + "\n")
    subprocess.run(
        [str(BINARIES / "initdb"), "-D", str(data), "-U", "postgres", "--auth-local=trust",
         "--auth-host=scram-sha-256", f"--pwfile={pwfile}", "-E", "UTF8", "--no-instructions"],
        check=True, capture_output=True,
    )  # fmt: skip
    port, log = _free_port(), root / "server.log"
    subprocess.run(
        [str(BINARIES / "pg_ctl"), "-D", str(data), "-l", str(log), "-w", "-o",
         (f"-p {port} -k {sock} -c listen_addresses=127.0.0.1 -c log_min_error_statement=error"
          " -c log_min_messages=warning"), "start"],
        check=True, capture_output=True,
    )  # fmt: skip
    owner_role = "riz_like_owner"
    pgpass = root / "owner-pgpass"
    pgpass.write_text(f"*:*:*:*:{PASSWORD}\n")
    pgpass.chmod(0o600)
    made = Cluster(data, sock, port, log, pgpass, root / "key-pgpass", owner_role)
    try:
        # The machine's M0 roles as db-roles.sql makes them, and one for the owner's own user, each
        # with a password the owner holds; the superuser's is in the owner's file too (as here).
        for statement in (
            f"CREATE ROLE vextrus LOGIN CREATEDB PASSWORD '{PASSWORD}'",
            f"CREATE ROLE vextrus_app LOGIN PASSWORD '{PASSWORD}'",
            f"CREATE ROLE {owner_role} LOGIN PASSWORD '{PASSWORD}'",
            "CREATE DATABASE vextrus OWNER vextrus",
        ):
            done = made.psql(statement)
            assert done.returncode == 0, done.stderr
        sql = subprocess.run(
            ["psql", "-X", "-q", "-h", str(sock), "-p", str(port), "-U", "postgres", "-d", "postgres",
             "-f", str(ROLES_SQL)],
            capture_output=True, text=True, check=False,
        )  # fmt: skip
        assert sql.returncode == 0, sql.stderr
        passwords = made.script("new_password vextrus_heldout && new_password vextrus_heldout_app")
        assert passwords.returncode == 0, passwords.stdout + passwords.stderr
        hba = made.script(f'install_hba "{data / "pg_hba.conf"}" "{root / "pg_hba.conf.copy"}"')
        assert hba.returncode == 0, hba.stdout + hba.stderr
        time.sleep(0.5)  # the postmaster takes the reload's signal
        yield made
    finally:
        subprocess.run(
            [str(BINARIES / "pg_ctl"), "-D", str(data), "-m", "immediate", "stop"],
            capture_output=True,
            check=False,
        )


@needs_postgres
def test_the_owners_roles_and_the_superuser_cannot_reach_the_heldout_database(cluster: Cluster) -> None:
    for role in ("vextrus", "vextrus_app", cluster.owner_role, "postgres"):
        # The password works: the role reaches the cluster's other database...
        assert cluster.psql("select 1", user=role, host="127.0.0.1").returncode == 0, role
        # ...and is refused this one, over TCP and over the socket.
        for host in ("127.0.0.1", str(cluster.socket)):
            refused = cluster.psql("select 1", user=role, db=DB, host=host)
            assert refused.returncode != 0, (role, host)
            assert "pg_hba.conf rejects connection" in refused.stderr, refused.stderr


@needs_postgres
def test_only_the_two_roles_reach_it_with_the_key_users_passwords(cluster: Cluster) -> None:
    mode = cluster.key_pgpass.stat().st_mode & 0o777
    assert mode == 0o600
    for role in HELD:
        done = cluster.psql(
            "select current_user", user=role, db=DB, host="127.0.0.1", pgpass=cluster.key_pgpass
        )
        assert done.returncode == 0, done.stderr
        assert done.stdout.strip() == role
        # Never over the socket, and never with the owner's passwords.
        assert cluster.psql("select 1", user=role, db=DB, pgpass=cluster.key_pgpass).returncode != 0
        assert cluster.psql("select 1", user=role, db=DB, host="127.0.0.1").returncode != 0


@needs_postgres
def test_connect_is_revoked_whatever_pg_hba_says(cluster: Cluster) -> None:
    for role in ("vextrus", "vextrus_app", cluster.owner_role):
        done = cluster.psql(f"select has_database_privilege('{role}', '{DB}', 'CONNECT')")
        assert done.stdout.strip() == "f", role
    # vextrus has CREATEDB, and still cannot copy it.
    copy = cluster.psql(f"CREATE DATABASE heldout_copy TEMPLATE {DB}", user="vextrus", host="127.0.0.1")
    assert copy.returncode != 0
    assert "permission denied" in copy.stderr


@needs_postgres
def test_the_sql_is_idempotent_and_stops_on_a_role_that_may_still_connect(cluster: Cluster) -> None:
    def run_sql() -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["psql", "-X", "-q", "-h", str(cluster.socket), "-p", str(cluster.port), "-U", "postgres",
             "-d", "postgres", "-f", str(ROLES_SQL)],
            capture_output=True, text=True, check=False,
        )  # fmt: skip

    assert run_sql().returncode == 0
    assert cluster.psql(f"GRANT CONNECT ON DATABASE {DB} TO vextrus").returncode == 0
    try:
        stopped = run_sql()
        assert stopped.returncode != 0
        assert "these roles may still connect to vextrus_heldout: vextrus" in stopped.stderr
    finally:
        assert cluster.psql(f"REVOKE CONNECT ON DATABASE {DB} FROM vextrus").returncode == 0
    assert cluster.psql("GRANT pg_read_server_files TO vextrus_app").returncode == 0
    try:
        stopped = run_sql()
        assert "may read or run files on the server: vextrus_app" in stopped.stderr
    finally:
        assert cluster.psql("REVOKE pg_read_server_files FROM vextrus_app").returncode == 0
    assert run_sql().returncode == 0


@needs_postgres
def test_a_failing_heldout_statement_leaves_nothing_in_the_shared_server_log(cluster: Cluster) -> None:
    # The owner's user reads the cluster's log (group adm on this machine): an error's statement and its
    # DETAIL would carry a row's values there.
    def fail(db: str, user: str, marker: str, pgpass: Path) -> None:
        done = cluster.psql(
            f'select 1/0 as "{marker}"', user=user, db=db, host="127.0.0.1", pgpass=pgpass
        )
        assert done.returncode != 0

    fail(DB, "vextrus_heldout_app", "heldout-marker-7f3a", cluster.key_pgpass)
    fail("vextrus", "vextrus", "control-marker-7f3a", cluster.pgpass)
    time.sleep(0.5)
    log = cluster.log.read_text()
    assert "control-marker-7f3a" in log  # the log does keep a failing statement elsewhere
    assert "heldout-marker-7f3a" not in log
    # The instance's roles cannot turn the log back on.
    for setting in ("log_min_messages", "log_min_error_statement", "log_statement"):
        value = "all" if setting == "log_statement" else "debug1"
        done = cluster.psql(
            f"SET {setting} = '{value}'",
            user="vextrus_heldout_app",
            db=DB,
            host="127.0.0.1",
            pgpass=cluster.key_pgpass,
        )
        assert done.returncode != 0, setting
        assert "permission denied" in done.stderr, setting


@needs_postgres
def test_putting_the_block_in_again_keeps_one_block_and_the_walls(cluster: Cluster) -> None:
    hba = cluster.data / "pg_hba.conf"
    again = cluster.script(f'install_hba "{hba}" "{cluster.data.parent / "pg_hba.conf.copy2"}"')
    assert again.returncode == 0, again.stdout + again.stderr
    assert hba.read_text().count(">>> vextrus-heldout") == 1
    time.sleep(0.5)
    assert cluster.psql("select 1", user="vextrus", db=DB, host="127.0.0.1").returncode != 0


@needs_postgres
def test_a_pg_hba_with_an_error_is_put_back_and_never_loaded(cluster: Cluster, tmp_path: Path) -> None:
    hba = cluster.data / "pg_hba.conf"
    before = hba.read_text()
    broken = before + "hostx all all 127.0.0.1/32 trust\n"
    hba.write_text(broken)
    try:
        done = cluster.script(f'install_hba "{hba}" "{tmp_path / "copy"}"')
        assert done.returncode != 0
        assert "error(s): the copy was put back" in done.stdout
        assert hba.read_text() == broken  # the copy taken first, which held the error, is back
    finally:
        hba.write_text(before)


@needs_postgres
def test_the_sql_stops_on_a_role_that_may_set_role_to_a_server_files_role_or_copy_the_cluster(
    cluster: Cluster,
) -> None:
    # The refuter of M1-06: USAGE missed a membership WITH INHERIT FALSE that may still SET ROLE, and
    # nothing looked for a REPLICATION role (a base backup copies every database).
    def run_sql() -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["psql", "-X", "-q", "-h", str(cluster.socket), "-p", str(cluster.port), "-U", "postgres",
             "-d", "postgres", "-f", str(ROLES_SQL)],
            capture_output=True, text=True, check=False,
        )  # fmt: skip

    granted = cluster.psql("GRANT pg_execute_server_program TO vextrus WITH INHERIT FALSE, SET TRUE")
    assert granted.returncode == 0, granted.stderr
    try:
        stopped = run_sql()
        assert "may read or run files on the server: vextrus" in stopped.stderr
    finally:
        assert cluster.psql("REVOKE pg_execute_server_program FROM vextrus").returncode == 0
    # The refuter, round 2 (15): a second superuser, named like a Unix user, signs in by peer.
    assert cluster.psql("CREATE ROLE someone_super SUPERUSER LOGIN").returncode == 0
    try:
        stopped = run_sql()
        assert "these roles are superusers besides postgres: someone_super" in stopped.stderr
    finally:
        assert cluster.psql("DROP ROLE someone_super").returncode == 0
    assert cluster.psql("ALTER ROLE vextrus_app REPLICATION").returncode == 0
    try:
        stopped = run_sql()
        assert "may copy the whole cluster (REPLICATION): vextrus_app" in stopped.stderr
    finally:
        assert cluster.psql("ALTER ROLE vextrus_app NOREPLICATION").returncode == 0
    assert run_sql().returncode == 0


@needs_postgres
def test_the_superuser_loses_its_password_only_when_the_owner_says_so(cluster: Cluster) -> None:
    # On this machine the owner's user (every build session's) signs in as the superuser with a password.
    assert cluster.psql("select 1", host="127.0.0.1").returncode == 0
    refused = cluster.script("close_superusers", answer="n\n")
    assert refused.returncode != 0
    assert "nothing in the cluster changed" in refused.stdout
    assert cluster.psql("select 1", host="127.0.0.1").returncode == 0
    try:
        closed = cluster.script("close_superusers", answer="y\n")
        assert closed.returncode == 0, closed.stdout + closed.stderr
        assert "no superuser signs in with a password now" in closed.stdout
        assert cluster.psql("select 1", host="127.0.0.1").returncode != 0  # the owner's line is dead
        assert cluster.psql("select 1").returncode == 0  # the socket (peer on the real cluster) stays
        assert "no superuser signs in with a password" in cluster.script("close_superusers").stdout
    finally:
        cluster.psql(f"ALTER ROLE postgres PASSWORD '{PASSWORD}'")  # for the other tests here


# ------------------------------------------------------------------------ a build session is refused


def guard_verdict(tool: str, tool_input: dict[str, str], project: str) -> str | None:
    """The rule the guard refuses this tool call with, or None (guard.test.mjs's seam, from Python)."""
    env = {k: v for k, v in os.environ.items() if k != "CLAUDE_CODE_REMOTE"}
    env["CLAUDE_PROJECT_DIR"] = project
    done = subprocess.run(
        ["node", str(GUARD)],
        input=json.dumps({"tool_name": tool, "tool_input": tool_input}),
        capture_output=True, text=True, env=env, check=False,
    )  # fmt: skip
    assert done.returncode == 0, done.stderr
    if not done.stdout.strip():
        return None
    out = json.loads(done.stdout)["hookSpecificOutput"]
    assert out["permissionDecision"] == "deny"
    return str(out["permissionDecisionReason"].split(":")[0])


@pytest.mark.skipif(shutil.which("node") is None, reason="no node here")
@pytest.mark.parametrize(
    "project",
    ["/home/riz/vextrus-cubit/.claude/worktrees/M1-06", "/home/riz/vextrus-cubit"],
    ids=["builder", "orchestrator"],
)
def test_a_build_sessions_bash_is_refused_every_place_of_the_instance(project: str) -> None:
    key_user = variable("KEY_USER")
    places = [
        variable(name) for name in ("INSTANCE", "STORE", "LOGS", "SETTINGS", "JEV_KEY", "KEY_PGPASS")
    ]
    commands = [
        *(f"cat {place}" for place in places),
        *(f"ls -la {place}" for place in places),
        f"tail -f {variable('LOGS')}/api.log",
        f"cp {variable('JEV_KEY')} /tmp/k",
        f"find /home/{key_user} -name '*.log'",
        f"sudo -u {key_user} {variable('SERVE')}",
        f"runuser -u {key_user} -- psql -h 127.0.0.1 -U vextrus_heldout_app -d {DB}",
    ]
    for command in commands:
        refused = guard_verdict("Bash", {"command": command}, project)
        # The key user's own pgpass file meets the secrets rule first; either refusal stops it.
        secret = command.endswith("/.pgpass")
        allowed = {"PRIVILEGE_RAISED", "SECRET_PRINTED"} if secret else {"PRIVILEGE_RAISED"}
        assert refused in allowed, (command, refused)


def test_a_build_sessions_read_is_refused_the_key_users_home() -> None:
    # Claude Code's own deny list, which a Read meets before any hook: the key user's whole home.
    deny = json.loads(SETTINGS.read_text())["permissions"]["deny"]
    home = variable("KEY_HOME")
    assert f"Read(/{home}/**)" in deny
    for name in ("INSTANCE", "STORE", "LOGS", "SETTINGS", "JEV_KEY", "KEY_PGPASS"):
        assert variable(name).startswith(home + "/")
