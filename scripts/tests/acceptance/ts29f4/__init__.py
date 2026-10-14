"""Ticket S29-F4: overlap landing. A head behind main is refused only for a risk-tier PR or a PR whose
files overlap a file changed on main since the commit its CI ran on (narrows S27-L825, #825)."""
