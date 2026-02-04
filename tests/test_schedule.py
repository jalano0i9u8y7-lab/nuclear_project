"""
Tests for nuclear.orchestration.schedule module

Validates:
- Asia/Taipei date resolver
- Command construction
- No network/API keys required
"""

import pytest
from datetime import datetime
from zoneinfo import ZoneInfo
from unittest.mock import patch, MagicMock


class TestTaipeiDateResolver:
    """Test Asia/Taipei date resolution."""
    
    def test_get_taipei_today_format(self):
        """Date should be in YYYY-MM-DD format."""
        from nuclear.orchestration.schedule import get_taipei_today
        
        date_str = get_taipei_today()
        
        # Should match YYYY-MM-DD pattern
        assert len(date_str) == 10
        assert date_str[4] == "-"
        assert date_str[7] == "-"
        
        # Should be parseable
        parsed = datetime.strptime(date_str, "%Y-%m-%d")
        assert parsed is not None
    
    def test_get_taipei_today_uses_taipei_tz(self):
        """Date should be computed in Asia/Taipei timezone."""
        from nuclear.orchestration.schedule import get_taipei_today, TAIPEI_TZ
        
        # Get what we compute
        computed_date = get_taipei_today()
        
        # Compare with direct Asia/Taipei datetime
        expected_date = datetime.now(TAIPEI_TZ).strftime("%Y-%m-%d")
        
        assert computed_date == expected_date
    
    def test_get_taipei_now_returns_taipei_tz(self):
        """get_taipei_now should return datetime with Asia/Taipei timezone."""
        from nuclear.orchestration.schedule import get_taipei_now, TAIPEI_TZ
        
        now = get_taipei_now()
        
        assert now.tzinfo is not None
        assert str(now.tzinfo) == str(TAIPEI_TZ)
    
    def test_is_monday_taipei(self):
        """is_monday_taipei should check weekday in Taipei timezone."""
        from nuclear.orchestration.schedule import is_monday_taipei, TAIPEI_TZ
        
        # This is a runtime check - just ensure it returns bool
        result = is_monday_taipei()
        assert isinstance(result, bool)
        
        # Verify it matches direct check
        expected = datetime.now(TAIPEI_TZ).weekday() == 0
        assert result == expected


class TestCommandConstruction:
    """Test command building for subprocess calls."""
    
    def test_build_daily_command_with_date(self):
        """build_daily_command should include provided date."""
        from nuclear.orchestration.schedule import build_daily_command
        
        cmd = build_daily_command("2026-02-05")
        
        assert "daily" in cmd
        assert "--date" in cmd
        assert "2026-02-05" in cmd
    
    def test_build_daily_command_placeholder(self):
        """build_daily_command without date should use shell placeholder."""
        from nuclear.orchestration.schedule import build_daily_command
        
        cmd = build_daily_command(None)
        
        assert "daily" in cmd
        assert "--date" in cmd
        # Shell expansion placeholder
        assert any("$(" in c or "${" in c for c in cmd) or "$(date" in " ".join(cmd)
    
    def test_build_weekly_command(self):
        """build_weekly_command should target schedule weekly."""
        from nuclear.orchestration.schedule import build_weekly_command
        
        cmd = build_weekly_command()
        
        assert "nuclear" in " ".join(cmd)
        assert "schedule" in cmd
        assert "weekly" in cmd


class TestRunDailyDryRun:
    """Test run_daily in dry-run mode (no actual execution)."""
    
    def test_run_daily_dry_run_returns_zero(self):
        """Dry run should return 0 without executing."""
        from nuclear.orchestration.schedule import run_daily
        
        result = run_daily(date="2026-02-05", dry_run=True)
        
        assert result == 0
    
    def test_run_daily_uses_today_if_no_date(self):
        """run_daily without date should use Taipei today."""
        from nuclear.orchestration.schedule import run_daily, get_taipei_today
        
        with patch("nuclear.orchestration.schedule.subprocess") as mock_sub:
            mock_sub.run.return_value = MagicMock(returncode=0, stderr="")
            
            # Just verify it doesn't crash; actual date is auto-computed
            result = run_daily(dry_run=True)
            assert result == 0


class TestRunWeeklyDryRun:
    """Test run_weekly in dry-run mode."""
    
    def test_run_weekly_dry_run_returns_zero(self):
        """Dry run should return 0 without executing."""
        from nuclear.orchestration.schedule import run_weekly
        
        result = run_weekly(dry_run=True)
        
        assert result == 0


class TestNoApiKeysRequired:
    """Verify schedule module doesn't require API keys."""
    
    def test_import_schedule_no_api_keys(self):
        """Importing schedule module should not require API keys."""
        import os
        
        # Ensure no API keys in env for this test
        api_keys = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GOOGLE_API_KEY"]
        original_values = {k: os.environ.get(k) for k in api_keys}
        
        for k in api_keys:
            if k in os.environ:
                del os.environ[k]
        
        try:
            # Should import without error
            from nuclear.orchestration import schedule
            
            # Should be able to get date without API
            date = schedule.get_taipei_today()
            assert date is not None
        finally:
            # Restore
            for k, v in original_values.items():
                if v is not None:
                    os.environ[k] = v
    
    def test_dry_run_no_network(self):
        """Dry run should not make network calls."""
        from nuclear.orchestration.schedule import run_daily, run_weekly
        
        # These should complete without network
        assert run_daily(dry_run=True) == 0
        assert run_weekly(dry_run=True) == 0
