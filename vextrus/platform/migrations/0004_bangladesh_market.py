# The Bangladesh Market and its Library tenant (ticket 02; s02 Q15; ADR 0038): Market data, so its
# literals are on the market-literal scan's allowlist. Run as the owner, which writes Library rows.
# Both ids are fixed, so the rows are the same in every database and `seed` may run again (the
# tests' flush empties every table, and vextrus/testing/tenancy.py puts these rows back).

import uuid

from django.db import migrations, transaction

LIBRARY_ID = uuid.UUID("01a0e713-563c-74c4-9eb3-48f87fc1678e")
MARKET_ID = uuid.UUID("01a0e713-563c-74c4-9eb3-48f94d9f16cd")

MARKET = {
    "code": "BD",
    "labels": {"en": "Bangladesh"},
    "currency_code": "BDT",
    "currency_minor_units": 2,
    "currency_symbol": "৳",
    "currency_symbol_position": {"en": "before"},
    # Lakh and crore grouping in Latin digits; English borrows en-IN's formats, since Chrome has
    # no en-BD formats (en-BD groups in thousands; docs/research/global-markets-foundation.md).
    "grouping": "lakh",
    "digits": "latn",
    "borrowed_locales": {"en": "en-IN"},
    "unit_systems": ["imperial", "metric"],
    "default_unit_system": "imperial",
    "languages": ["en"],
    "default_language": "en",
    "time_zone": "Asia/Dhaka",
    # Friday and Saturday off (ISO weekdays: 5 is Friday).
    "days_off": [5, 6],
    # The cell a Bangladeshi Developer lives in: the beta's Mumbai deployment (ADR 0034).
    "default_home_region": "asia-south1",
}


def seed(Market, Developer, using):
    """Write (or put back) the Market and its Library tenant, as they are above."""
    with transaction.atomic(using=using):
        Developer.objects.using(using).update_or_create(
            id=LIBRARY_ID,
            defaults={
                "tenant_id": LIBRARY_ID,
                "name": "Bangladesh Library",
                "market_id": MARKET_ID,
                "library_id": LIBRARY_ID,
                "home_region": MARKET["default_home_region"],
                "is_library": True,
            },
        )
        Market.objects.using(using).update_or_create(
            id=MARKET_ID, defaults={"tenant_id": LIBRARY_ID, **MARKET}
        )


def forward(apps, schema_editor):
    seed(
        apps.get_model("platform", "Market"),
        apps.get_model("platform", "Developer"),
        schema_editor.connection.alias,
    )


def backward(apps, schema_editor):
    # The two rows name each other; both keys are deferred, so one transaction removes both.
    schema_editor.execute("delete from platform_developer where id = %s", [LIBRARY_ID])
    schema_editor.execute("delete from platform_market where id = %s", [MARKET_ID])


class Migration(migrations.Migration):

    dependencies = [
        ("platform", "0003_row_level_security"),
    ]

    operations = [
        migrations.RunPython(forward, backward),
    ]
