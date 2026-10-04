# Drawings probe (session 12, throwaway)
Time: Sun Oct  4 21:52:19 UTC 2026
- token-set, jev-key-set
- clone exit=0 secs=3
- files (excluding .git): 17; size: 72M
- pytest -m needs_bwrap: 78 passed, 1 failed, 2 xfailed, 3 errors, 5129 deselected (0 skipped), ~7 min
- failed: scripts/real_drawings/tests/test_sandbox.py::test_a_bwrap_started_inside_runs_and_sees_no_network (nested bwrap: operation not permitted)
- errors (setup): vextrus/takeoff/tests/test_read_file.py::test_the_engines_readers_read_a_dwg_through_the_job, ::test_without_the_second_reader_a_dwg_ends_failed_saying_so, ::test_the_cad_worker_reads_an_uploaded_dwg_to_the_end
- bwrap --unshare-all --die-with-parent true: bwrap-exit=1 (bwrap started; "execvp true: No such file or directory" since no binds)
