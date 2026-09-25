# Every milestone passes on the Sample Project and on an Independent Set

A milestone is done only when its finish line passes, in the running product, on both the Sample
Project and at least one Independent Set: a real Drawing Set that the Vextrus team did not draw.

From day one the Independent Set is the Edison set. A Vextrus core member works at Edison Real Estate
Ltd. and has obtained permission to use it for development. It is read and analysed locally, it is
never committed or put into an issue, and its content becomes demo material only with the owner's
permission. Sets from client Developers' real projects join it as they arrive, with each client's
permission.

This rule exists because Vextrus Cubit passed every gate on drawings it generated itself and was
never tested on a drawing it did not author (docs/postmortem.md, cause 1). A reader that passes only
on the Sample Project is not done.

## The Hand Takeoff (owner's decision, 25 Sep 2026)
A team engineer measures one typical floor of the Sample Project and of each Independent Set by hand,
as a QS normally does. The figures are kept in `.private/` and out of every build session's reach.
The owner compares Vextrus's figures with them when walking M1 and M2. It is our own truth, made from
the drawings, not from a model an agent could fit to.
