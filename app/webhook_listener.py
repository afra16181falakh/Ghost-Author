import logging
from fastapi import FastAPI, BackgroundTasks
import uvicorn
from app.repo_listener import run_ghost_author

logger = logging.getLogger("ghost_author")

app = FastAPI(title="Ghost Author Webhook Listener")

@app.get("/")
def read_root():
    return {"name": "Ghost Author Webhook Listener", "status": "active"}

@app.post("/webhook")
def trigger_webhook(background_tasks: BackgroundTasks):
    logger.info("Webhook received, queuing Ghost Author cycle...")
    background_tasks.add_task(run_ghost_author)
    return {"status": "processing", "message": "Ghost Author cycle started in the background."}

if __name__ == "__main__":
    uvicorn.run("app.webhook_listener:app", host="0.0.0.0", port=8000, reload=True)
