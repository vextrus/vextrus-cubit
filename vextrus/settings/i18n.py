"""Languages and time: markets are data (ADR 0038).

Times are stored in UTC and shown in the Market's time zone by the web's formatters; the admin shows
a time in the acting Developer's Market's zone (`AdminTimeZoneMiddleware`), so `TIME_ZONE` stays
"UTC". English is the
only language shipped. The server never formats a figure for a reader: no thousand separators and no
`localize` (the market-literal scan refuses it); every figure goes to the web as a number and through
the formatter for its kind with the Project's Market.
"""

USE_TZ = True
TIME_ZONE = "UTC"
USE_I18N = True
LANGUAGE_CODE = "en"
LANGUAGES = [("en", "English")]
USE_THOUSAND_SEPARATOR = False
