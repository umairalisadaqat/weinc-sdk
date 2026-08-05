"""weinc — WeInc AI website builder API client.

Thin, zero-dependency client for the WeInc v1 REST API
(https://my.we.inc/api/v1). See https://my.we.inc/docs/api for API docs
and https://we.inc for the product.
"""

from .client import DEFAULT_BASE_URL, WeIncClient, WeIncError

__version__ = "0.1.0"
__all__ = ["WeIncClient", "WeIncError", "DEFAULT_BASE_URL", "__version__"]
