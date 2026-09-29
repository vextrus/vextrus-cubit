"""The Check catalogue's codes (ticket 19b): each Check's name in the Library, with no parameters.

A Check's `MESSAGE` (engine/check/catalogue.py; docs/data-model.md §3.4, Check's "message_code (its
words)") is its name, which 19a's Library rows carry and a screen shows without values; a finding's
own code, with its values, is the finding's. Worded in web/src/messages/engine/catalogue/en.po. A
Check added later (18's `render_f1`) may name itself here or in its own file: any engine code with
no parameters will do.
"""

from engine.messages import MessageCode

BANGLA_ANSI = MessageCode("engine.catalogue.bangla_ansi")
COVERAGE = MessageCode("engine.catalogue.coverage")
DECODERS_AGREE = MessageCode("engine.catalogue.decoders_agree")
PLOT_PAGES = MessageCode("engine.catalogue.plot_pages")
REGISTER = MessageCode("engine.catalogue.register")
STOREY_TITLES = MessageCode("engine.catalogue.storey_titles")
