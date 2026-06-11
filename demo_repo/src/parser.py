def parse_record(record):
    # Bloated function with deeply nested conditionals.
    # Ghost Author will target this function to simplify it.
    if record is not None:
        if "header" in record:
            header = record["header"]
            if header.get("status") == "active":
                if "data" in record:
                    data = record["data"]
                    # Process data
                    result = []
                    for item in data:
                        if item.get("value") is not None:
                            result.append(item["value"] * 2)
                    return {"status": "success", "data": result}
    return {"status": "error", "message": "invalid"}
