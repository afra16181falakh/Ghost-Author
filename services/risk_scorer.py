"""
ML-based smell risk scoring.

When >= 10 historical samples exist in Postgres run history, trains a
GradientBoostingClassifier (sklearn) on [cognitive_complexity, nesting_depth,
length] to predict P(this smell gets fixed). Smells fixed more often are
considered higher risk — Ghost Author tackles them first.

Falls back to a weighted heuristic when sklearn is unavailable or data is sparse.
"""
import logging
from typing import Any, Dict, List

logger = logging.getLogger("ghost_author")

try:
    import numpy as np
    from sklearn.ensemble import GradientBoostingClassifier
    from sklearn.preprocessing import StandardScaler
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False


def _heuristic_score(smell: Dict[str, Any]) -> float:
    """Weighted heuristic risk score in [0, 1]. Works without sklearn."""
    cog    = float(smell.get("cognitive_complexity", 0))
    nest   = float(smell.get("nesting_depth", 0))
    length = float(smell.get("length", 0))
    score  = (cog / 40.0) * 0.5 + (nest / 8.0) * 0.3 + (length / 60.0) * 0.2
    return round(min(1.0, score), 4)


class RiskScorer:
    """
    Trains on historical SmellReport+Run data to predict which smells are
    riskiest (most likely to cause real bugs based on past fix history).
    """
    MIN_SAMPLES = 10

    def __init__(self):
        self._model: Any   = None
        self._scaler: Any  = None
        self._trained      = False

    # ── Features ─────────────────────────────────────────────────────────────

    @staticmethod
    def _feat(smell: Dict[str, Any]) -> List[float]:
        return [
            float(smell.get("cognitive_complexity", 0)),
            float(smell.get("nesting_depth", 0)),
            float(smell.get("length", 0)),
        ]

    # ── Training ─────────────────────────────────────────────────────────────

    def train(self, training_data: List[Dict[str, Any]]) -> bool:
        """
        training_data: list of dicts with keys:
          cognitive_complexity, nesting_depth, length, fixed (bool)

        Returns True if ML model trained, False if fell back to heuristic.
        """
        if not HAS_SKLEARN or len(training_data) < self.MIN_SAMPLES:
            logger.info(
                f"RiskScorer: {len(training_data)} samples — using heuristic "
                f"(need {self.MIN_SAMPLES} for ML)"
            )
            return False

        X = np.array([self._feat(d) for d in training_data])
        y = np.array([1 if d.get("fixed") else 0 for d in training_data])

        self._scaler = StandardScaler()
        X_s = self._scaler.fit_transform(X)

        self._model = GradientBoostingClassifier(
            n_estimators=80,
            max_depth=3,
            learning_rate=0.1,
            subsample=0.8,
            random_state=42,
        )
        self._model.fit(X_s, y)
        self._trained = True
        logger.info(f"RiskScorer: ML model trained on {len(training_data)} samples")
        return True

    # ── Scoring ──────────────────────────────────────────────────────────────

    def score(self, smell: Dict[str, Any]) -> float:
        """Return risk score in [0, 1]. Higher = riskier, fix first."""
        if not self._trained:
            return _heuristic_score(smell)
        feat   = np.array([self._feat(smell)])
        feat_s = self._scaler.transform(feat)
        prob   = self._model.predict_proba(feat_s)[0][1]
        return round(float(prob), 4)

    def rank(self, smells: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Return smells sorted by descending risk score (riskiest first)."""
        scored = [{**s, "risk_score": self.score(s)} for s in smells]
        scored.sort(key=lambda s: s["risk_score"], reverse=True)
        return scored
