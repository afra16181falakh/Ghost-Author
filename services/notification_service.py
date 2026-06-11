"""
Notification service — fires after a run completes.

Channels supported:
  • Slack  — via SLACK_WEBHOOK_URL env var (incoming webhook)
  • GitHub — PR comment via GITHUB_TOKEN (uses the existing token)

Both channels are fire-and-forget: failures are logged but never raise.
"""
import logging
from typing import Optional

import httpx

logger = logging.getLogger("ghost_author")


class NotificationService:
    def __init__(
        self,
        slack_webhook_url: Optional[str] = None,
        github_token: Optional[str] = None,
    ):
        self.slack_url = slack_webhook_url or ""
        self.gh_token  = github_token or ""

    # ── Public API ────────────────────────────────────────────────────────────

    async def notify_run_complete(
        self,
        repo_name: str,
        filepath: str,
        total_fixed: int,
        total_issues: int,
        pr_url: Optional[str],
        duration_sec: float,
    ) -> None:
        """Dispatch to all configured channels concurrently."""
        if self.slack_url:
            await self._slack(repo_name, filepath, total_fixed, total_issues, pr_url, duration_sec)

    async def comment_on_pr(self, pr_url: str, body: str) -> None:
        """Add a comment to a GitHub PR via the Issues Comments API."""
        if not self.gh_token or not pr_url:
            return
        try:
            # https://github.com/owner/repo/pull/42
            #  → https://api.github.com/repos/owner/repo/issues/42/comments
            parts      = pr_url.rstrip("/").split("/")
            pr_number  = parts[-1]
            repo_path  = "/".join(parts[-4:-2])
            api_url    = f"https://api.github.com/repos/{repo_path}/issues/{pr_number}/comments"
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(
                    api_url,
                    json={"body": body},
                    headers={
                        "Authorization": f"token {self.gh_token}",
                        "Accept": "application/vnd.github.v3+json",
                    },
                )
            logger.info(f"GitHub PR comment posted to {pr_url}")
        except Exception as exc:
            logger.warning(f"GitHub PR comment failed: {exc}")

    # ── Slack ─────────────────────────────────────────────────────────────────

    async def _slack(
        self,
        repo_name: str,
        filepath: str,
        total_fixed: int,
        total_issues: int,
        pr_url: Optional[str],
        duration_sec: float,
    ) -> None:
        icon    = "✅" if total_fixed > 0 else "❌"
        status  = f"Fixed {total_fixed}/{total_issues} smell(s)"
        blocks  = [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": (
                        f"{icon} *Ghost Author* finished on `{repo_name}`\n"
                        f"> *File:* `{filepath}`\n"
                        f"> *Result:* {status} in {duration_sec:.1f}s"
                        + (f"\n> *PR:* {pr_url}" if pr_url else "")
                    ),
                },
            }
        ]
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.post(self.slack_url, json={"blocks": blocks})
                if resp.status_code != 200:
                    logger.warning(f"Slack responded {resp.status_code}: {resp.text}")
                else:
                    logger.info("Slack notification sent")
        except Exception as exc:
            logger.warning(f"Slack notification failed: {exc}")
