"""Synthetic fixture generators, one file each (`dwg/<name>.py`, `pdf/<name>.py`), run at test time.

A synthetic DWG is never committed: each generator writes into pytest's temporary directory
(`dwg/__init__.py` says how, and which writer, under which licence).
"""
