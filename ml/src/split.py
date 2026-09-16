"""Stable user-disjoint 60/20/20 split; never split pairs from the same user across sets."""
import hashlib
def user_split(user_id):
    bucket=int(hashlib.sha256(('split_v1:'+str(user_id)).encode()).hexdigest()[:8],16)%10
    return 'train' if bucket<6 else 'validation' if bucket<8 else 'test'

def validate_splits(frame):
    if set(frame['split']) != {'train','validation','test'}:raise ValueError('ALL_THREE_SPLITS_REQUIRED')
    for key in ['search_id',*(['user_id'] if 'user_id' in frame else [])]:
        if (frame.groupby(key)['split'].nunique()!=1).any():raise ValueError('SPLIT_LEAKAGE_'+key)
