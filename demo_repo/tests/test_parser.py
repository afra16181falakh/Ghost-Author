from src.parser import parse_record

def test_parse_record_success():
    record = {
        "header": {"status": "active"},
        "data": [{"value": 5}, {"value": 10}, {"value": None}]
    }
    result = parse_record(record)
    assert result["status"] == "success"
    assert result["data"] == [10, 20]

def test_parse_record_invalid_status():
    record = {
        "header": {"status": "inactive"},
        "data": [{"value": 5}]
    }
    result = parse_record(record)
    assert result["status"] == "error"

def test_parse_record_missing_header():
    record = {
        "data": [{"value": 5}]
    }
    result = parse_record(record)
    assert result["status"] == "error"

def test_parse_record_none():
    result = parse_record(None)
    assert result["status"] == "error"
