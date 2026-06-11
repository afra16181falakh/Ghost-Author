import os
import json
import logging
import urllib.request
from typing import Dict, Any

logger = logging.getLogger("ghost_author")

class GitHubClient:
    def __init__(self, enabled: bool, repo_owner: str, repo_name: str, token: str = None):
        self.enabled = enabled
        self.repo_owner = repo_owner
        self.repo_name = repo_name
        self.token = token or os.getenv("GITHUB_TOKEN")

    def create_pull_request(self, title: str, body: str, head_branch: str, base_branch: str = "main") -> Dict[str, Any]:
        if not self.enabled:
            logger.info("GitHub PR creation is disabled by feature flag. Skipping remote API call.")
            return {"success": False, "msg": "GitHub Client Disabled", "pr_url": None}

        if not self.token:
            logger.error("GitHub token is not configured. Please set the GITHUB_TOKEN environment variable.")
            return {"success": False, "msg": "Missing GITHUB_TOKEN", "pr_url": None}

        url = f"https://api.github.com/repos/{self.repo_owner}/{self.repo_name}/pulls"
        headers = {
            "Authorization": f"token {self.token}",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json"
        }
        
        payload = {
            "title": title,
            "body": body,
            "head": head_branch,
            "base": base_branch,
            "draft": True
        }

        try:
            req = urllib.request.Request(
                url, 
                data=json.dumps(payload).encode('utf-8'), 
                headers=headers, 
                method='POST'
            )
            with urllib.request.urlopen(req) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                pr_url = res_data.get("html_url")
                logger.info(f"Successfully created draft Pull Request: {pr_url}")
                return {"success": True, "msg": "PR Created", "pr_url": pr_url}
        except Exception as e:
            logger.error(f"Failed to create remote GitHub PR: {e}")
            return {"success": False, "msg": str(e), "pr_url": None}
