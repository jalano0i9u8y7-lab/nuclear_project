"""Cloudflare R2 client - content-addressed, gzip, put/get."""

import gzip
import hashlib
import json
from typing import Any, Optional

from nuclear.config import settings

_r2_client: Optional["R2Client"] = None


class R2Client:
    """S3-compatible R2 client for cold data (snapshots, reasoning_trace)."""

    def __init__(self):
        self._client = None
        self._bucket = settings.r2_bucket_name
        self._endpoint = settings.r2_endpoint_url or (
            f"https://{settings.r2_account_id}.r2.cloudflarestorage.com"
            if settings.r2_account_id
            else ""
        )

    def _ensure_client(self):
        if self._client is None and settings.r2_access_key_id:
            import boto3

            self._client = boto3.client(
                "s3",
                endpoint_url=self._endpoint,
                aws_access_key_id=settings.r2_access_key_id,
                aws_secret_access_key=settings.r2_secret_access_key,
                region_name="auto",
            )
        return self._client

    def content_key(self, content: str | bytes, prefix: str = "nuclear") -> str:
        """Content-addressed key (SHA256)."""
        data = content.encode("utf-8") if isinstance(content, str) else content
        h = hashlib.sha256(data).hexdigest()
        return f"{prefix}/{h[:2]}/{h[2:4]}/{h}"

    def put(self, key: str, content: str | bytes, gzip_compress: bool = True) -> str:
        """Put content, return key."""
        client = self._ensure_client()
        if client is None:
            raise RuntimeError("R2 not configured")

        data = content.encode("utf-8") if isinstance(content, str) else content
        extra = {}
        if gzip_compress and len(data) > 256:
            data = gzip.compress(data)
            extra["ContentEncoding"] = "gzip"
        client.put_object(Bucket=self._bucket, Key=key, Body=data, **extra)
        return key

    def get(self, key: str, gunzip: bool = True) -> bytes:
        """Get content."""
        client = self._ensure_client()
        if client is None:
            raise RuntimeError("R2 not configured")

        resp = client.get_object(Bucket=self._bucket, Key=key)
        data = resp["Body"].read()
        if gunzip:
            try:
                data = gzip.decompress(data)
            except gzip.BadGzipFile:
                pass
        return data

    def put_json(self, content: dict[str, Any], prefix: str = "nuclear") -> str:
        """Put JSON, return content-addressed key."""
        s = json.dumps(content, ensure_ascii=False)
        key = self.content_key(s, prefix=prefix)
        self.put(key, s, gzip_compress=True)
        return key


def get_r2_client() -> R2Client:
    global _r2_client
    if _r2_client is None:
        _r2_client = R2Client()
    return _r2_client
