"""Stand-ins for the system tools the cloud scripts call, for ticket S14-C1's acceptance tests.

Run as `python _fake_tools.py <state.json> <log.jsonl> <tool> <args...>` by the one-line wrappers
`_world.py` puts first on PATH. Nothing here touches a real database, a package manager or the network.

The PostgreSQL 18 stand-in keeps one cluster in `state.json`: `running`, `roles` (name -> attributes and
`password`) and `databases` (name -> `owner`, and a `marker` a test may plant to see the database is the
same one afterwards). It understands:
- starting and stopping: `pg_ctl ... start|stop|restart|status`, `pg_ctlcluster 18 main <action>`,
  `service postgresql <action>`, `systemctl <action> postgresql[...]`; `pg_isready` (0 when running,
  else 2); `pg_lsclusters`; `initdb` and `pg_createcluster` (the cluster already exists: no-ops);
  `--version` of `psql`, `pg_ctl`, `postgres`, `pg_config` and `initdb` (PostgreSQL 18.0);
- running as the postgres user: `su [-] postgres -c '<command>'`, `runuser -u postgres -- <command>`,
  `runuser [-l] postgres -c '<command>'` and `sudo [-n] [-u postgres] [-E] [-H] <command>` run the
  command as this user;
- `psql` with SQL from `-c`/`--command`, `-f`/`--file` or stdin, psql variables from `-v`/`--set`
  (`:'name'`, `:name`), and `\\set`, `\\gexec`. While the cluster is stopped every client exits 2
  ("Connection refused"). Statements: `CREATE ROLE|USER`, `ALTER ROLE|USER` (LOGIN, SUPERUSER,
  CREATEDB, CREATEROLE, BYPASSRLS, REPLICATION and their NO forms, `[ENCRYPTED] PASSWORD '<p>'`),
  `CREATE DATABASE <d> [WITH] [OWNER [=] <r>]`, `ALTER DATABASE <d> OWNER TO <r>`, `DROP ROLE|USER|
  DATABASE [IF EXISTS]`; `SELECT '<statement>' WHERE [NOT] EXISTS (SELECT ... FROM pg_roles|pg_user|
  pg_authid|pg_database WHERE rolname|usename|datname = '<name>') \\gexec`; the probes `SELECT <x> FROM
  pg_roles|pg_user|pg_authid|pg_database WHERE <name column> = '<name>'` (prints `1` when the row
  exists) and `SELECT [NOT] EXISTS (<that probe>)` (prints `t` or `f`); `SHOW server_version` and
  `SELECT version()`. GRANT, REVOKE, COMMENT, SET, `\\connect` and other meta-commands are accepted and
  do nothing. A `DO` block or any other CREATE is refused as unsupported (exit 3), so a test fails
  loudly rather than passing on SQL this stand-in cannot judge. Creating what exists, or altering what
  does not, is the server's error ("already exists" / "does not exist"), as PostgreSQL does.
- `createuser [-s] [-d] [-r] [--no-...] <role>`, `createdb [-O <owner>] <database>`, `dropuser` and
  `dropdb`.

Every other tool on the list (curl, wget, apt-get, apt, gh, pip, npx, npm, uv, playwright, chromium,
google-chrome, gpg, dotnet) only records its call and exits 0 without doing anything. Every call is one
JSON line in the log: `{"tool", "argv", "events"}`; an event is `[kind, detail]` with kinds `start`,
`stop`, `create_role`, `alter_role`, `create_database`, `drop`, `error`, `unsupported`, `sql`.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

VERSION = "18.0"
ATTRS = ("login", "superuser", "createdb", "createrole", "bypassrls", "replication", "inherit")
NAME_COLUMN = {
    "pg_roles": "rolname",
    "pg_user": "usename",
    "pg_authid": "rolname",
    "pg_database": "datname",
}


class Fake:
    def __init__(self, state_path: Path, log_path: Path, tool: str, argv: list[str]) -> None:
        self.state_path = state_path
        self.log_path = log_path
        self.tool = tool
        self.argv = argv
        self.state: dict[str, Any] = json.loads(state_path.read_text())
        self.events: list[list[str]] = []
        self.vars: dict[str, str] = {}
        self.stop_on_error = False

    def save(self) -> None:
        self.state_path.write_text(json.dumps(self.state, indent=1, sort_keys=True))
        with self.log_path.open("a") as log:
            log.write(json.dumps({"tool": self.tool, "argv": self.argv, "events": self.events}) + "\n")

    def event(self, kind: str, detail: str) -> None:
        self.events.append([kind, detail])

    # --- the server -------------------------------------------------------------------------------
    def control(self, action: str) -> int:
        if action in ("start", "restart", "reload"):
            if not self.state["running"]:
                self.event("start", self.tool)
            self.state["running"] = True
            return 0
        if action == "stop":
            if self.state["running"]:
                self.event("stop", self.tool)
            self.state["running"] = False
            return 0
        if action in ("status", "is-active"):
            print("online" if self.state["running"] else "down")
            return 0 if self.state["running"] else 3
        return 0

    def refused(self) -> int:
        print(
            'psql: error: connection to server at "127.0.0.1", port 5432 failed: Connection refused',
            file=sys.stderr,
        )
        return 2

    # --- SQL ----------------------------------------------------------------------------------------
    def substitute(self, text: str) -> str:
        def quoted(match: re.Match[str]) -> str:
            value = self.vars.get(match.group(1), "")
            return "'" + value.replace("'", "''") + "'"

        text = re.sub(r":'(\w+)'", quoted, text)
        text = re.sub(r':"(\w+)"', lambda m: '"' + self.vars.get(m.group(1), "") + '"', text)
        return re.sub(r"(?<![:\w]):(\w+)\b", lambda m: self.vars.get(m.group(1), m.group(0)), text)

    def run_script(self, text: str) -> int:
        buffer = ""
        for line in text.splitlines():
            stripped = line.strip()
            if "\\gexec" in line:
                before = line.split("\\gexec", 1)[0]
                statement = self.substitute(buffer + "\n" + before).strip().rstrip(";")
                buffer = ""
                rc = self.gexec(statement)
                if rc:
                    return rc
                continue
            if stripped.startswith("\\"):
                parts = stripped.split(None, 2)
                if parts[0] == "\\set" and len(parts) == 3:
                    self.vars[parts[1]] = parts[2].strip("'")
                continue
            if stripped.startswith("--"):
                continue
            buffer += line + "\n"
            while True:
                cut = split_point(buffer)
                if cut is None:
                    break
                statement, buffer = buffer[:cut], buffer[cut + 1 :]
                rc = self.statement(self.substitute(statement))
                if rc:
                    return rc
        if buffer.strip():
            return self.statement(self.substitute(buffer))
        return 0

    def gexec(self, select: str) -> int:
        match = re.match(r"(?is)^select\s+'((?:[^']|'')*)'\s*(where\s+(.*))?$", select.strip())
        if not match:
            self.event("unsupported", select)
            print(f"fake psql: unsupported \\gexec query: {select}", file=sys.stderr)
            return 3
        statement = match.group(1).replace("''", "'")
        if match.group(3) is None or self.condition(match.group(3)):
            return self.statement(statement)
        return 0

    def condition(self, text: str) -> bool:
        text = text.strip()
        negate = False
        found = re.match(r"(?is)^not\s+(.*)$", text)
        if found:
            negate, text = True, found.group(1)
        found = re.match(r"(?is)^exists\s*\((.*)\)\s*$", text)
        if not found:
            raise Unsupported(text)
        return self.probe(found.group(1)) != negate

    def probe(self, select: str) -> bool:
        found = re.search(
            r"(?is)\bfrom\s+(?:pg_catalog\.)?(pg_roles|pg_user|pg_authid|pg_database)\s+"
            r"where\s+(\w+)\s*=\s*'([^']*)'",
            select,
        )
        if not found or found.group(2).lower() != NAME_COLUMN[found.group(1).lower()]:
            raise Unsupported(select)
        table = "databases" if found.group(1).lower() == "pg_database" else "roles"
        return found.group(3) in self.state[table]

    def statement(self, sql: str) -> int:
        sql = sql.strip().rstrip(";").strip()
        if not sql:
            return 0
        self.event("sql", sql)
        words = sql.split()
        head = " ".join(w.upper() for w in words[:2])
        try:
            if re.match(r"(?is)^(create)\s+(role|user)\b", sql):
                return self.create_role(sql)
            if re.match(r"(?is)^alter\s+(role|user)\b", sql):
                return self.alter_role(sql)
            if re.match(r"(?is)^create\s+database\b", sql):
                return self.create_database(sql)
            if re.match(r"(?is)^alter\s+database\b", sql):
                return self.alter_database(sql)
            if re.match(r"(?is)^drop\s+(role|user|database)\b", sql):
                return self.drop(sql)
            if re.match(r"(?is)^show\s+server_version", sql):
                print(VERSION)
                return 0
            if re.match(r"(?is)^select\s+version\(\)", sql):
                print(f"PostgreSQL {VERSION} on x86_64-pc-linux-gnu")
                return 0
            if re.match(r"(?is)^select\b", sql):
                return self.select(sql)
            if head.startswith(
                ("GRANT", "REVOKE", "COMMENT", "SET", "RESET", "BEGIN", "COMMIT", "ALTER DEFAULT")
            ):
                return 0
            if head.startswith(("DO", "CREATE")):
                raise Unsupported(sql)
            return 0
        except Unsupported as error:
            self.event("unsupported", str(error))
            print(f"fake psql: unsupported SQL: {error}", file=sys.stderr)
            return 3

    def select(self, sql: str) -> int:
        found = re.match(r"(?is)^select\s+(not\s+)?exists\s*\((.*)\)\s*$", sql)
        if found:
            print("t" if self.probe(found.group(2)) != bool(found.group(1)) else "f")
            return 0
        if re.search(r"(?is)\bfrom\s+(?:pg_catalog\.)?(pg_roles|pg_user|pg_authid|pg_database)\b", sql):
            if self.probe(sql):
                print("1")
            return 0
        if re.match(r"(?is)^select\s+'", sql):
            raise Unsupported(sql)
        return 0

    def apply_attrs(self, role: dict[str, Any], text: str) -> None:
        password = re.search(r"(?is)\b(?:encrypted\s+)?password\s+('(?:[^']|'')*'|null)", text)
        if password:
            value = password.group(1)
            role["password"] = None if value.lower() == "null" else value[1:-1].replace("''", "'")
            text = text[: password.start()] + text[password.end() :]
        for word in re.findall(r"[A-Za-z]+", text):
            lowered = word.lower()
            if lowered in ATTRS:
                role[lowered] = True
            elif lowered.startswith("no") and lowered[2:] in ATTRS:
                role[lowered[2:]] = False

    def error(self, message: str) -> int:
        self.event("error", message)
        print(f"ERROR:  {message}", file=sys.stderr)
        return 1 if self.stop_on_error else 0

    def create_role(self, sql: str) -> int:
        found = re.match(r"(?is)^create\s+(role|user)\s+\"?(\w+)\"?(.*)$", sql)
        if not found:
            raise Unsupported(sql)
        name = found.group(2)
        if name in self.state["roles"]:
            return self.error(f'role "{name}" already exists')
        role: dict[str, Any] = dict.fromkeys(ATTRS, False)
        role.update(inherit=True, login=found.group(1).lower() == "user", password=None)
        self.apply_attrs(role, found.group(3))
        self.state["roles"][name] = role
        self.event("create_role", name)
        return 0

    def alter_role(self, sql: str) -> int:
        found = re.match(r"(?is)^alter\s+(?:role|user)\s+\"?(\w+)\"?(.*)$", sql)
        if not found:
            raise Unsupported(sql)
        name = found.group(1)
        if name not in self.state["roles"]:
            return self.error(f'role "{name}" does not exist')
        self.apply_attrs(self.state["roles"][name], found.group(2))
        self.event("alter_role", name)
        return 0

    def create_database(self, sql: str) -> int:
        found = re.match(r"(?is)^create\s+database\s+\"?(\w+)\"?(.*)$", sql)
        if not found:
            raise Unsupported(sql)
        name = found.group(1)
        owner = re.search(r"(?is)\bowner\s*=?\s*\"?(\w+)", found.group(2))
        return self.make_database(name, owner.group(1) if owner else "postgres")

    def make_database(self, name: str, owner: str) -> int:
        if name in self.state["databases"]:
            return self.error(f'database "{name}" already exists')
        if owner not in self.state["roles"]:
            return self.error(f'role "{owner}" does not exist')
        self.state["databases"][name] = {"owner": owner}
        self.event("create_database", name)
        return 0

    def alter_database(self, sql: str) -> int:
        found = re.match(r"(?is)^alter\s+database\s+\"?(\w+)\"?\s+owner\s+to\s+\"?(\w+)", sql)
        if not found:
            return 0
        name, owner = found.groups()
        if name not in self.state["databases"]:
            return self.error(f'database "{name}" does not exist')
        self.state["databases"][name]["owner"] = owner
        return 0

    def drop(self, sql: str) -> int:
        found = re.match(r"(?is)^drop\s+(role|user|database)\s+(if\s+exists\s+)?\"?(\w+)", sql)
        if not found:
            raise Unsupported(sql)
        table = "databases" if found.group(1).lower() == "database" else "roles"
        name = found.group(3)
        if name not in self.state[table]:
            return 0 if found.group(2) else self.error(f'"{name}" does not exist')
        del self.state[table][name]
        self.event("drop", f"{table}:{name}")
        return 0

    # --- the tools ----------------------------------------------------------------------------------
    def psql(self) -> int:
        args = list(self.argv)
        scripts: list[str] = []
        self.stop_on_error = False
        index = 0
        while index < len(args):
            arg = args[index]
            value: str | None = None
            if arg in ("--version", "-V"):
                print(f"psql (PostgreSQL) {VERSION}")
                return 0
            if arg.startswith("--"):
                key, _, inline = arg.partition("=")
                takes = key in (
                    "--command",
                    "--file",
                    "--set",
                    "--variable",
                    "--dbname",
                    "--username",
                    "--host",
                    "--port",
                    "--output",
                    "--field-separator",
                    "--record-separator",
                )
                if takes:
                    if inline:
                        value = inline
                    else:
                        index += 1
                        value = args[index]
                    if key == "--command":
                        scripts.append(value)
                    elif key == "--file":
                        scripts.append(read_file(value))
                    elif key in ("--set", "--variable"):
                        self.set_var(value)
                index += 1
                continue
            if arg.startswith("-") and len(arg) > 1:
                cluster = arg[1:]
                for position, flag in enumerate(cluster):
                    if flag in "cfvdUhpoFRPLT":
                        rest = cluster[position + 1 :]
                        if rest:
                            value = rest
                        else:
                            index += 1
                            value = args[index]
                        if flag == "c":
                            scripts.append(value)
                        elif flag == "f":
                            scripts.append(read_file(value))
                        elif flag == "v":
                            self.set_var(value)
                        break
                index += 1
                continue
            index += 1
        if not self.state["running"]:
            return self.refused()
        if not scripts:
            scripts.append(sys.stdin.read() if not sys.stdin.isatty() else "")
        for script in scripts:
            if "ON_ERROR_STOP" in script and re.search(
                r"ON_ERROR_STOP\s*(=\s*)?(on|1|true)", script, re.I
            ):
                self.stop_on_error = True
            try:
                rc = self.run_script(script)
            except Unsupported as error:
                self.event("unsupported", str(error))
                print(f"fake psql: unsupported SQL: {error}", file=sys.stderr)
                return 3
            if rc:
                return 3 if self.stop_on_error else rc
        return 0

    def set_var(self, value: str) -> None:
        name, _, setting = value.partition("=")
        self.vars[name] = setting
        if name == "ON_ERROR_STOP" and setting.lower() in ("1", "on", "true"):
            self.stop_on_error = True

    def createuser(self) -> int:
        if any(a in ("--version", "-V") for a in self.argv):
            print(f"createuser (PostgreSQL) {VERSION}")
            return 0
        if not self.state["running"]:
            return self.refused()
        flags = {
            "-s": "superuser",
            "--superuser": "superuser",
            "-d": "createdb",
            "--createdb": "createdb",
            "-r": "createrole",
            "--createrole": "createrole",
        }
        role: dict[str, Any] = dict.fromkeys(ATTRS, False)
        role.update(inherit=True, login=True, password=None)
        names = []
        skip = False
        for arg in self.argv:
            if skip:
                skip = False
                continue
            if arg in ("-h", "-p", "-U", "--host", "--port", "--username"):
                skip = True
            elif arg in flags:
                role[flags[arg]] = True
            elif arg.startswith("--no-") and arg[5:] in ATTRS:
                role[arg[5:]] = False
            elif not arg.startswith("-"):
                names.append(arg)
        self.stop_on_error = True
        name = names[-1]
        if name in self.state["roles"]:
            self.error(f'role "{name}" already exists')
            return 1
        self.state["roles"][name] = role
        self.event("create_role", name)
        return 0

    def createdb(self) -> int:
        if any(a in ("--version", "-V") for a in self.argv):
            print(f"createdb (PostgreSQL) {VERSION}")
            return 0
        if not self.state["running"]:
            return self.refused()
        owner, names, skip = "postgres", [], None
        for arg in self.argv:
            if skip:
                if skip == "owner":
                    owner = arg
                skip = None
                continue
            if arg in ("-O", "--owner"):
                skip = "owner"
            elif arg.startswith("--owner="):
                owner = arg.split("=", 1)[1]
            elif arg in ("-h", "-p", "-U", "-E", "-T", "--host", "--port", "--username"):
                skip = "other"
            elif not arg.startswith("-"):
                names.append(arg)
        self.stop_on_error = True
        rc = self.make_database(names[0], owner)
        return 1 if self.events and self.events[-1][0] == "error" else rc

    def as_user(self) -> int:
        """su, runuser and sudo: run the command as this user."""
        args = list(self.argv)
        if "-c" in args or "--command" in args or any(a.startswith("--command=") for a in args):
            for index, arg in enumerate(args):
                if arg in ("-c", "--command"):
                    return subprocess.run(["sh", "-c", args[index + 1]], check=False).returncode
                if arg.startswith("--command="):
                    return subprocess.run(["sh", "-c", arg.split("=", 1)[1]], check=False).returncode
        if "--" in args:
            rest = args[args.index("--") + 1 :]
        else:
            rest, index = [], 0
            while index < len(args):
                arg = args[index]
                if arg in ("-u", "-g", "--user", "--group", "-C", "-D", "-s"):
                    index += 2
                    continue
                if arg.startswith("-"):
                    index += 1
                    continue
                rest = args[index:]
                break
            if self.tool in ("su", "runuser") and rest:
                rest = rest[1:]  # the user name
        if not rest:
            return 1
        return subprocess.run(rest, check=False).returncode

    def main(self) -> int:
        tool, argv = self.tool, self.argv
        self.stop_on_error = False
        if tool in ("su", "runuser", "sudo"):
            self.save()
            return self.as_user()
        if tool in ("pg_ctl", "postgres", "pg_config", "initdb") and "--version" in argv:
            print(f"{tool} (PostgreSQL) {VERSION}" if tool != "pg_config" else f"PostgreSQL {VERSION}")
            return 0
        if tool == "pg_ctl":
            action = next((a for a in argv if a in ("start", "stop", "restart", "status", "reload")), "")
            return self.control(action)
        if tool == "pg_ctlcluster":
            words = [a for a in argv if not a.startswith("-")]
            return self.control(words[2] if len(words) > 2 else "")
        if tool == "service":
            if argv[:1] == ["postgresql"] and len(argv) > 1:
                return self.control(argv[1])
            return 0
        if tool == "systemctl":
            words = [a for a in argv if not a.startswith("-")]
            if len(words) > 1 and words[1].startswith("postgresql"):
                return self.control(words[0])
            return 0
        if tool == "pg_isready":
            return 0 if self.state["running"] else 2
        if tool == "pg_lsclusters":
            status = "online" if self.state["running"] else "down"
            data, log = "/var/lib/postgresql/18/main", "/var/log/postgresql/postgresql-18-main.log"
            print(f"18  main    5432 {status} postgres {data} {log}")
            return 0
        if tool in ("initdb", "pg_createcluster"):
            return 0
        if tool == "psql":
            return self.psql()
        if tool == "createuser":
            return self.createuser()
        if tool == "createdb":
            return self.createdb()
        if tool in ("dropdb", "dropuser"):
            names = [a for a in argv if not a.startswith("-")]
            if names:
                table = "databases" if tool == "dropdb" else "roles"
                self.state[table].pop(names[-1], None)
                self.event("drop", f"{table}:{names[-1]}")
            return 0
        return 0  # a recorder: curl, apt-get, npx, playwright and the rest


class Unsupported(Exception):
    pass


def split_point(buffer: str) -> int | None:
    """The index of the first `;` outside quotes and dollar quotes, or None."""
    index, quote = 0, None
    while index < len(buffer):
        char = buffer[index]
        if quote == "'":
            if char == "'":
                quote = None
        elif quote == "$$":
            if buffer.startswith("$$", index):
                quote = None
                index += 1
        elif char == "'":
            quote = "'"
        elif buffer.startswith("$$", index):
            quote = "$$"
            index += 1
        elif char == ";":
            return index
        index += 1
    return None


def read_file(path: str) -> str:
    return sys.stdin.read() if path == "-" else Path(path).read_text()


def main() -> int:
    state, log, tool, *argv = sys.argv[1:]
    fake = Fake(Path(state), Path(log), tool, argv)
    try:
        return fake.main()
    finally:
        if tool not in ("su", "runuser", "sudo"):
            fake.save()


if __name__ == "__main__":
    sys.exit(main())
