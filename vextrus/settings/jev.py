"""Jev, TypeSafe's judgement model (ADR 0011; 15 fills the client).

Only the environment variable's name lives here; the key itself is never written, printed or
committed (CLAUDE.md, Law). Live calls happen only in tests marked `live`.
"""

VEXTRUS_JEV_KEY_VARIABLE = "TYPESAFE_API_KEY"
