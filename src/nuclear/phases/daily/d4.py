from nuclear.phases.daily.contracts import D4Output
from nuclear.phases.daily.adapters.macro_adapter import MacroAdapter, StubMacroAdapter

def run_d4(date: str, adapter: MacroAdapter = None) -> D4Output:
    """
    D-4: Macro worldview specialist.
    """
    adapter = adapter or StubMacroAdapter()
    macro_data = adapter.fetch(date)
    
    return D4Output(
        date=date,
        macro_prices_stub=macro_data,
        macro_derivatives_stub={},
        signals={"macro_trend": "stable"}
    )
