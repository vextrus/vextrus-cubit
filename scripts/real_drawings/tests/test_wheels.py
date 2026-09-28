"""The requirements the sandbox installs from: ezdxf's compiled wheel pinned by the hash
toolchain/ezdxf.lock names, in place of the registry's hashes (the M0 plan, the real-drawing check,
step 2). The wheel here is invented bytes; nothing is downloaded."""

import hashlib
from pathlib import Path

import pytest

from scripts.real_drawings.source import Refused
from scripts.real_drawings.wheels import pin_ezdxf

REQUIREMENTS = """\
django==6.1.1 \\
    --hash=sha256:585fb82bf15053c42cf52e67c2f1b54a032dca384759315fd6678ab1870d1d72
ezdxf==1.4.4 \\
    --hash=sha256:666edda631ba717270293b734f5d58dd97a1d1aba4787187f09d0cc584645865 \\
    --hash=sha256:da5a5e0e6bdbb6656f9c017b47edc7eafceb419d61a2b5de64ffb344c168e593
fonttools==4.66.0 \\
    --hash=sha256:03922992966a1830b94a750961d1ccfe1a7375d792ca61077a5afb719811788a
"""
WHEEL = "ezdxf-1.4.4-cp314-cp314-linux_x86_64.whl"


def lock(checkout: Path, wheel: str, sha: str) -> None:
    (checkout / "toolchain").mkdir(parents=True)
    (checkout / "toolchain" / "ezdxf.lock").write_text(
        f'version = "1.4.4"\nwheel = "{wheel}"\nwheel_sha256 = "{sha}"\n'
        'release = "toolchain-ezdxf-1.4.4"\n'
    )


def test_the_compiled_wheels_hash_replaces_the_registrys(tmp_path: Path) -> None:
    wheels = tmp_path / "wheels"
    wheels.mkdir()
    (wheels / WHEEL).write_bytes(b"an invented wheel")
    lock(tmp_path / "src", WHEEL, hashlib.sha256(b"an invented wheel").hexdigest())

    pinned = pin_ezdxf(REQUIREMENTS, tmp_path / "src", wheels)

    sha = hashlib.sha256(b"an invented wheel").hexdigest()
    assert f"ezdxf==1.4.4 \\\n    --hash=sha256:{sha}\nfonttools" in pinned
    assert "666edda6" not in pinned
    assert "da5a5e0e" not in pinned
    assert pinned.startswith("django==6.1.1 \\\n    --hash=sha256:585fb82b")


def test_the_pure_wheel_leaves_the_requirements_as_uv_lock_has_them(tmp_path: Path) -> None:
    lock(tmp_path / "src", "ezdxf-1.4.4-py3-none-any.whl", "666edda6" + "0" * 56)

    assert pin_ezdxf(REQUIREMENTS, tmp_path / "src", tmp_path / "wheels") == REQUIREMENTS


def test_a_lock_naming_another_ezdxf_than_uv_lock_is_refused(tmp_path: Path) -> None:
    lock(tmp_path / "src", WHEEL, "0" * 64)

    with pytest.raises(Refused, match=r"does not lock ezdxf 1\.4\.4"):
        pin_ezdxf(REQUIREMENTS.replace("ezdxf==1.4.4", "ezdxf==1.4.3"), tmp_path / "src", tmp_path)
