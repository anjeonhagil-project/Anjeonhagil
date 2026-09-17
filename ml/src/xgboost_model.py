"""XGBoost comparison adapter using the same frozen train scale and X8 as Logistic."""
import numpy as np
import xgboost as xgb
from inference import FEATURES
class BundledXGBoost:
    def __init__(self, model):
        if model.xgb is None:raise ValueError('XGBOOST_UNAVAILABLE')
        self.model=model
    def predict_proba(self,x):
        p=self.model.xgb.predict(xgb.DMatrix(np.asarray(x,dtype=np.float32)/self.model.xgb_spec['scale'],feature_names=FEATURES))
        return np.column_stack([1-p,p])
