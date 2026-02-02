"""R2 client test - put/get, content-addressed key."""

import pytest

from nuclear.storage.r2_client import R2Client


def test_content_key():
    client = R2Client()
    key1 = client.content_key("hello")
    key2 = client.content_key("hello")
    assert key1 == key2
    assert key1.startswith("nuclear/")


def test_content_key_different():
    client = R2Client()
    key1 = client.content_key("hello")
    key2 = client.content_key("world")
    assert key1 != key2
