import logging

logger = logging.getLogger("ghost_author")

class PatchApplier:
    @staticmethod
    def apply_patch(filepath: str, refactored_code: str) -> bool:
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(refactored_code)
            logger.info(f"Successfully applied refactored patch to {filepath}")
            return True
        except Exception as e:
            logger.error(f"Failed to write patch to {filepath}: {e}")
            return False
