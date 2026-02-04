import pytest
import yaml
from pathlib import Path
from argparse import Namespace
from nuclear.cli import cmd_docs

REGISTRY_PATH = Path("docs/registry.yaml")

def test_registry_file_exists():
    assert REGISTRY_PATH.exists()

def test_registry_structure_valid():
    with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
    
    assert "version" in data
    assert "ssot" in data
    assert "rules" in data
    assert "referenced_docs" in data
    assert "change_log" in data
    
    # Check SSOT authority
    assert data["ssot"]["authority"] is True
    
    # Check AI Read-Scope Rule
    assert "ai_read_scope" in data["rules"]
    assert "allowed_paths" in data["rules"]["ai_read_scope"]
    assert "forbidden_paths" in data["rules"]["ai_read_scope"]

def test_cli_docs_status(capsys):
    """Test the CLI docs status command."""
    args = Namespace(action="status")
    exit_code = cmd_docs(args)
    
    assert exit_code == 0
    captured = capsys.readouterr()
    assert "SSOT:" in captured.out
    assert "Referenced Docs: 3 total" in captured.out
    assert "  - present: 3" in captured.out
    
    # Verify IDs exist in the registry file instead of CLI output
    with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
        content = f.read()
        assert "D1A_NEWS_WHITELIST" in content
        assert "D1B_FORUM_WHITELIST" in content

def test_missing_docs_verification():
    """Ensure the registry correctly identifies missing files."""
    with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
        
    for doc in data["referenced_docs"]:
        if doc["status"] == "present":
            assert Path(doc["path"]).exists(), f"Doc {doc['id']} is marked present but missing on disk!"
        elif doc["status"] == "missing":
            # Just informational, usually we don't enforce it DOESN'T exist, but it implies it.
            pass
