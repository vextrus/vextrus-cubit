"""`set_staff`: make a user one of Vextrus's staff, or not, through the owner alias.

`vextrus_app` cannot change the staff flag (it updates only a user's name, phone, password and last
sign-in), so a web or worker process can never make anyone staff; only the owner can, here.
"""

from typing import Any

from django.core.management.base import BaseCommand, CommandError, CommandParser

from vextrus.platform.database import OWNER_ALIAS
from vextrus.platform.models import User


class Command(BaseCommand):
    help = "Make the user with this email one of Vextrus's staff (or not, with --off), as the owner."

    def add_arguments(self, parser: CommandParser) -> None:
        parser.add_argument("email")
        parser.add_argument("--off", action="store_true", help="Take the staff flag away.")

    def handle(self, *args: Any, **options: Any) -> None:
        staff = not options["off"]
        changed = (
            User.objects.using(OWNER_ALIAS)
            .filter(email__iexact=options["email"])
            .update(is_vextrus_staff=staff)
        )
        if changed != 1:
            raise CommandError(f"no user has the email {options['email']}")
        self.stdout.write(f"{options['email'].lower()}: {'staff' if staff else 'not staff'}")
