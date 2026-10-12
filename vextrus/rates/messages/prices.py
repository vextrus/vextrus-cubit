"""`rates`' codes for the Market Prices (ticket S16-RT). Worded in `web/src/messages/rates/prices/en.po`.

- `price_changed` (an act, in the Project's acts): who set a price; the payload holds the ids only.
- `amount_invalid`: a price that is not a plain non-negative decimal, or has more than four decimal
  places, or is out of range (400). The price stays as it was.
- `resource_unknown`: a price edit naming a Resource the Market's Library does not have (404): the
  code the QS named (`code`).
- `price_set_missing`: the Developer has no Market Price set and the Market's Library holds no
  starter to take one from (404).
"""

from engine.messages import MessageCode

PRICE_CHANGED = MessageCode("rates.prices.price_changed", params=("actor",), event=True)
AMOUNT_INVALID = MessageCode("rates.prices.amount_invalid")
RESOURCE_UNKNOWN = MessageCode("rates.prices.resource_unknown", params=("code",))
PRICE_SET_MISSING = MessageCode("rates.prices.price_set_missing")
