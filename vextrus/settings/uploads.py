"""Uploads: the largest drawing file accepted, and how every request's files stream (ticket 14).

`vextrus.drawings.uploads.DrawingUploadHandler` is the only handler: it spools each file to a private
temporary file and refuses the request, keeping nothing, past one file or past the limit, as the
bytes arrive, whatever the Content-Length says. Django parses a body before sign-in (at the CSRF
check), so the limit bounds everyone, signed in or not.
"""

# The limit per file. Drawings run 5 to 20 MB (docs/research/dwg-reader-options.md: "$0.06-$0.25 per
# 5-20 MB drawing"); the largest file of the two Development Sets is 27 MB (measured 29 Sep 2026).
# 200 MB is seven times that, room for a whole set plotted to one PDF, while bounding what one
# upload may cost in disk and in reading. m0-screens 4.5's toast names it ("larger than 200 MB").
VEXTRUS_UPLOAD_MAX_BYTES = 200 * 1024 * 1024
# Files per request: the web sends each file on its own, with its own progress (m0-screens 4.5).
VEXTRUS_UPLOAD_MAX_FILES = 1
FILE_UPLOAD_HANDLERS = ["vextrus.drawings.uploads.DrawingUploadHandler"]
# Files larger than this are spooled to a temporary file rather than held in memory (the handler
# spools every file; kept for any handler Django falls back to).
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024
# A request's body other than its files (Django's default is 2.5 MB).
DATA_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024
