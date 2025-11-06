"""Integration tests for health endpoints."""

from __future__ import annotations

from http import HTTPStatus

from tests.integration.helpers import get_public_json


def test_health_endpoint_reports_status(flask_client):
    """GET /health returns overall status and database connectivity info."""
    # Hit the simple health probe and confirm it returns status plus DB connectivity metadata
    response, payload = get_public_json(flask_client, "/health")

    assert response.status_code in (HTTPStatus.OK, HTTPStatus.SERVICE_UNAVAILABLE)
    assert payload["status"] in ("healthy", "unhealthy")
    assert "database" in payload and "connected" in payload["database"]


def test_health_detailed_endpoint_includes_metrics(flask_client):
    """GET /health/detailed returns extended system metrics."""
    # The detailed endpoint should include system and table metrics in addition to core status
    response, payload = get_public_json(flask_client, "/health/detailed")

    assert response.status_code in (HTTPStatus.OK, HTTPStatus.SERVICE_UNAVAILABLE)
    assert "system" in payload
    assert "statistics" in payload
    assert "checks" in payload
