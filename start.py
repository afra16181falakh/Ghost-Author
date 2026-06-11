"""
Quick-start script — runs the Ghost Author API server.
Usage:  python start.py
"""
import uvicorn

if __name__ == "__main__":
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        ws="websockets",
        log_level="info",
    )
