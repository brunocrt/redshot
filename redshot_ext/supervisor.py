
from dataclasses import dataclass
import pandas as pd
from .risk import drawdown_throttle

@dataclass
class SafetyConfig:
    warn_dd: float = -0.10
    hard_dd: float = -0.15
    max_spread_bps: float = 30.0
    max_latency_ms: int = 1500

def live_safety_checks(equity: pd.Series,
                       recent_spread_bps: float | None = None,
                       recent_latency_ms: int | None = None,
                       cfg: SafetyConfig = SafetyConfig()) -> dict:
    mult = drawdown_throttle(equity, warn=cfg.warn_dd, hard=cfg.hard_dd)
    reasons = []
    if mult == 0.0:
        reasons.append("hard drawdown reached")
    if recent_spread_bps and recent_spread_bps > cfg.max_spread_bps:
        mult = 0.0
        reasons.append("excessive spread")
    if recent_latency_ms and recent_latency_ms > cfg.max_latency_ms:
        mult = 0.0
        reasons.append("excessive latency")
    return {"risk_multiplier": mult, "reasons": reasons}
