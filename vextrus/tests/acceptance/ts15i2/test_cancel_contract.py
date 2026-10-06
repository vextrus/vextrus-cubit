"""S15-I2 (rebuilding T-W327, #331): the cancel operation declares its 409 in the OpenAPI schema, so
the web's generated types carry the refusal `{code, params}` it answers when the cancel came too late
(`drawings.files.cancel_too_late`; its behaviour is
`vextrus/drawings/tests/acceptance/tw327/test_cancel_too_late.py`'s). Here, not beside it: the schema
is `vextrus.api`'s, a layer above `drawings`.
"""

from vextrus.api import api


def test_the_schema_declares_the_cancel_operations_409_as_a_refusal() -> None:
    paths = api.get_openapi_schema()["paths"]
    [route] = [path for path in paths if path.endswith("/drawings/files/{file_id}/cancel")]

    responses = {str(status): answer for status, answer in paths[route]["post"]["responses"].items()}

    assert "409" in responses
    reference = str(responses["409"]["content"]["application/json"]["schema"])
    assert "Refusal" in reference
