"""The frozen X8 input uses displayed seconds, metres and weighted raw6; no Q1/Q3/Q4 feature."""
import math
from inference import FEATURES

def candidate_vector(candidate, weights):
    if len(weights)!=6 or any(type(w) not in (int,float) or not math.isfinite(w) or w<0 for w in weights):
        raise ValueError('INVALID_WEIGHTS')
    if not (sum(weights)==0 or math.isclose(sum(weights),1,abs_tol=1e-8)):
        raise ValueError('INVALID_WEIGHT_SUM')
    raw=candidate['raw_features']
    if len(raw)!=6:raise ValueError('INVALID_RAW6')
    values=[candidate['display_duration_s'],candidate['distance_m'],*raw]
    if any(type(v) not in (int,float) or not math.isfinite(v) or v<0 for v in values):
        raise ValueError('INVALID_FEATURE_VALUE')
    return [v*w for v,w in zip(values,[1.,1.,*weights])]
