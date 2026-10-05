"""A tiny reader for an agent's or skill's frontmatter (`key: value` lines between the first two `---`
lines, a list as `[a, b]`, `a, b` or `- a` lines), with no YAML dependency."""

from pathlib import Path

REPO = Path(__file__).resolve().parents[5]


def split(path: Path) -> tuple[dict[str, str | list[str]], str]:
    """The frontmatter and the body of a Markdown file."""
    text = path.read_text()
    assert text.startswith("---\n"), f"{path.name} has no frontmatter"
    head, body = text[4:].split("\n---\n", 1)
    found: dict[str, str | list[str]] = {}
    last = ""
    for line in head.splitlines():
        stripped = line.strip()
        if stripped.startswith("- ") and last:
            listed = found[last]
            found[last] = [*(listed if isinstance(listed, list) else []), stripped[2:].strip()]
        elif ":" in line and not line.startswith(" "):
            key, value = line.split(":", 1)
            last = key.strip()
            found[last] = value.strip()
    return found, body


def as_list(value: str | list[str] | None) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return [part.strip().strip("'\"") for part in value.strip("[]").split(",") if part.strip()]
