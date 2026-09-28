"""Uploads: the largest drawing file accepted, and how Django spools it (14 sets the limit)."""

# The limit per file. 500 MB is docs/design/m0-screens.md's placeholder; 14 sets the real figure.
VEXTRUS_UPLOAD_MAX_BYTES = 500 * 1024 * 1024
# Files larger than this are spooled to a temporary file rather than held in memory.
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024
# A request's body other than its files (Django's default is 2.5 MB).
DATA_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024
