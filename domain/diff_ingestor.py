import os
import logging
from typing import List

logger = logging.getLogger("ghost_author")

# We defer importing git to runtime to ensure GitPython is installed in the test env
class DiffIngestor:
    def __init__(self, repo_path: str):
        self.repo_path = repo_path
        self._repo = None

    @property
    def repo(self):
        if self._repo is None:
            import git
            self._repo = git.Repo(self.repo_path)
        return self._repo

    def get_changed_files(self, base_commit: str = "HEAD~1", target_commit: str = "HEAD") -> List[str]:
        changed_files = []
        try:
            diff_index = self.repo.commit(base_commit).diff(target_commit)
            for diff in diff_index:
                if diff.change_type in ('M', 'A'):
                    changed_files.append(diff.b_path)
        except Exception as e:
            logger.debug(f"Git diff query failed, trying uncommitted index: {e}")
            try:
                # If commits don't exist yet, get local uncommitted diffs
                for item in self.repo.index.diff(None):
                    if item.change_type in ('M', 'A'):
                        changed_files.append(item.b_path)
                for file in self.repo.untracked_files:
                    changed_files.append(file)
            except Exception as e2:
                logger.error(f"Failed to query git files: {e2}")
        return list(set(changed_files))

    def get_modified_lines(self, filepath: str, base_commit: str = "HEAD~1") -> List[int]:
        modified_lines = []
        try:
            diff_output = self.repo.git.diff(base_commit, "--", filepath)
            for line in diff_output.splitlines():
                if line.startswith("@@"):
                    parts = line.split(" ")
                    if len(parts) >= 3:
                        new_range_part = parts[2]  # e.g., "+10,6"
                        if new_range_part.startswith("+"):
                            range_nums = new_range_part[1:].split(",")
                            start = int(range_nums[0])
                            count = int(range_nums[1]) if len(range_nums) > 1 else 1
                            for i in range(start, start + count):
                                modified_lines.append(i)
        except Exception as e:
            logger.debug(f"Could not compute precise line diff for {filepath}: {e}")
            # Fallback: treat all lines as modified
            try:
                full_path = os.path.join(self.repo_path, filepath)
                with open(full_path, 'r', encoding='utf-8') as f:
                    return list(range(1, len(f.readlines()) + 1))
            except Exception:
                pass
        return modified_lines
