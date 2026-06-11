import os
import pytest
import ast
from unittest.mock import MagicMock, patch
from domain.policy_guard import PolicyGuard
from domain.suppression_registry import SuppressionRegistry
from services.pr_writer import PRWriter

def test_policy_guard_filepaths():
    guard = PolicyGuard(
        allowlist_dirs=["src", "app"],
        blacklist_dirs=["tests", "configs"]
    )
    
    # Allowed paths
    assert guard.is_file_allowed("src/parser.py") is True
    assert guard.is_file_allowed("app/repo_listener.py") is True
    
    # Blacklisted paths
    assert guard.is_file_allowed("tests/test_parser.py") is False
    assert guard.is_file_allowed("configs/settings.yaml") is False
    
    # Not in allowlist
    assert guard.is_file_allowed("other_dir/utils.py") is False

def test_policy_guard_import_validation():
    guard = PolicyGuard(allowlist_dirs=[], blacklist_dirs=[])
    
    # Safe imports
    safe_code = """
import os
import sys
from datetime import datetime
"""
    assert guard.validate_imports(safe_code) is True

    # Hallucinated or non-existent import (should fail)
    unsafe_code = """
import os
import non_existent_pkg_xyz_123
"""
    assert guard.validate_imports(unsafe_code) is False

def test_suppression_registry():
    # Helper to test suppression on functions
    code_with_ignore = """
# Some comments
# ghost-ignore
def process_data(data):
    pass
"""
    code_without_ignore = """
def process_data(data):
    pass
"""
    tree_with = ast.parse(code_with_ignore)
    tree_without = ast.parse(code_without_ignore)

    func_with = next(node for node in ast.walk(tree_with) if isinstance(node, ast.FunctionDef))
    func_without = next(node for node in ast.walk(tree_without) if isinstance(node, ast.FunctionDef))

    assert SuppressionRegistry.is_function_ignored(func_with, code_with_ignore) is True
    assert SuppressionRegistry.is_function_ignored(func_without, code_without_ignore) is False

def test_pr_writer():
    smells = [{
        "function_name": "parse_record",
        "smells": [{"type": "nested_conditionals", "msg": "Nesting limit exceeded"}]
    }]
    test_outcome = {
        "success": True,
        "command": "pytest",
        "output": "3 passed in 0.05s"
    }
    
    summary = PRWriter.generate_pr_summary(
        filepath="src/parser.py",
        smells=smells,
        diff="--- a/src/parser.py\n+++ b/src/parser.py",
        test_outcome=test_outcome,
        attempts=1
    )
    
    assert "Ghost Author PR Summary" in summary
    assert "nested_conditionals" in summary
    assert "3 passed in 0.05s" in summary

@patch('services.refactor_planner.genai.Client')
@patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"})
def test_refactor_planner_gemini(mock_client_class):
    mock_client = MagicMock()
    mock_client_class.return_value = mock_client
    
    mock_response = MagicMock()
    mock_response.text = "```python\n# refactored code\ndef test(): pass\n```"
    mock_client.models.generate_content.return_value = mock_response
    
    from services.refactor_planner import RefactorPlanner
    smell = {"function_name": "test", "smells": [{"type": "large_function", "msg": "Too long"}]}
    res = RefactorPlanner.plan_refactor("src/test.py", "def test():\n    pass", smell)
    
    assert res == "# refactored code\ndef test(): pass"
    mock_client.models.generate_content.assert_called_once()

@patch('services.refactor_planner.genai.Client')
@patch('runners.test_runner.TestRunner.run_tests')
@patch.dict(os.environ, {"GEMINI_API_KEY": "fake_key"})
def test_retry_loop_with_feedback(mock_run_tests, mock_client_class):
    mock_client = MagicMock()
    mock_client_class.return_value = mock_client
    
    mock_response_1 = MagicMock()
    mock_response_1.text = "def parse_record(record):\n    # first attempt\n    pass"
    mock_response_2 = MagicMock()
    mock_response_2.text = "def parse_record(record):\n    # second attempt\n    pass"
    mock_client.models.generate_content.side_effect = [mock_response_1, mock_response_2]
    
    mock_run_tests.side_effect = [
        {"success": False, "output": "SyntaxError on line 1"},
        {"success": True, "output": "Tests passed"}
    ]
    
    from domain.policy_guard import PolicyGuard
    from runners.retry_loop import RetryLoop
    
    guard = PolicyGuard([], [])
    loop = RetryLoop(guard, max_attempts=3)
    
    with patch('runners.retry_loop.PatchApplier.apply_patch', return_value=True):
        res = loop.run("/fake/path", "src/parser.py", "original_code", {"function_name": "parse_record"})
        
        assert res["success"] is True
        assert res["attempts"] == 2
        assert res["refactored_code"] == "def parse_record(record):\n    # second attempt\n    pass"

@patch('runners.test_runner.subprocess.run')
def test_test_runner_docker(mock_run):
    mock_run.return_value = MagicMock(returncode=0, stdout="success", stderr="")
    
    from runners.test_runner import TestRunner
    res = TestRunner.run_tests("/fake/worktree", use_docker=True, docker_image="python:3.11-alpine")
    
    assert res["success"] is True
    cmd = mock_run.call_args[0][0]
    assert cmd[0] == "docker"
    assert cmd[1] == "run"
    assert cmd[2] == "--rm"
    assert cmd[3] == "-v"
    assert cmd[5] == "-w"
    assert cmd[7] == "python:3.11-alpine"

def test_webhook_listener():
    from fastapi.testclient import TestClient
    from app.webhook_listener import app
    
    client = TestClient(app)
    
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"name": "Ghost Author Webhook Listener", "status": "active"}
    
    with patch('app.webhook_listener.run_ghost_author') as mock_run:
        response = client.post("/webhook")
        assert response.status_code == 200
        assert response.json()["status"] == "processing"
        # Since it runs as BackgroundTask, we wait for FastAPI to process it or let test exit
        # TestClient processes background tasks before returning, so we can verify call
        mock_run.assert_called_once()

def test_cognitive_complexity():
    code = """
def complex_func(x):
    if x > 0:
        for i in range(x):
            if i % 2 == 0:
                print(i)
"""
    from services.ast_inspector import ASTInspector
    from services.smell_analyzer import SmellAnalyzer
    
    inspector = ASTInspector(code)
    funcs = inspector.find_functions()
    assert len(funcs) == 1
    func = funcs[0]
    assert func["cognitive_complexity"] == 6
    
    analyzer = SmellAnalyzer(max_cognitive=5)
    smells = analyzer.analyze_file("src/temp.py", code)
    assert len(smells) == 1
    assert smells[0]["cognitive_complexity"] == 6
    assert any(s["type"] == "cognitive_complexity" for s in smells[0]["smells"])
