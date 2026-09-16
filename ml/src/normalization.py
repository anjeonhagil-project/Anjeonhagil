"""Train-only standard deviations; centering is disabled to preserve pair symmetry."""
import numpy as np
from sklearn.preprocessing import StandardScaler
def fit_train_scaler(x):
    values=np.asarray(x,dtype=float)
    if values.ndim!=2 or values.shape[1]!=8 or not len(values) or not np.isfinite(values).all():raise ValueError('INVALID_TRAIN_X8')
    return StandardScaler(with_mean=False).fit(values)
