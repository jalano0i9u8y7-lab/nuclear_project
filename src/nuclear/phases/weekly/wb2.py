"""
WB-2 - order plan + order DSL.
SSOT: Each order must have worldview_version + identity_context.
"""

from nuclear.models.schemas import IdentityContext, OrderPlan


def run_wb2_light(stocks: list, worldview: dict) -> list[OrderPlan]:
    """WB-2 light path: no escalation."""
    return []


def run_wb2_heavy(stocks: list, worldview: dict, wa_report: dict) -> list[OrderPlan]:
    """WB-2 heavy path: escalation + W-A report."""
    return []
