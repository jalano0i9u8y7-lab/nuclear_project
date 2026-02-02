"""Storage layer - R2 for cold data."""

from nuclear.storage.r2_client import R2Client, get_r2_client

__all__ = ["R2Client", "get_r2_client"]
