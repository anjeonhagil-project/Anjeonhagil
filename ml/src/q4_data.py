"""Load Q4 preparation JSON as unscaled X8. Never use same-session fitted trial coefficients."""
import json, math
from pathlib import Path
import pandas as pd
from features import FEATURES
from split import user_split

def load_q4(path):
    dataset=json.loads(Path(path).read_text(encoding='utf-8-sig'))
    if dataset['manifest']['schema']!='q4_pairs_v1' or dataset['manifest']['feature_order']!=FEATURES:
        raise ValueError('Q4_EXPORT_CONTRACT_MISMATCH')
    rows=[];seen=set();excluded=0
    for record in dataset['rows']:
        key=(record['session_id'],record['question_index'])
        if key in seen:raise ValueError('DUPLICATE_Q4_ANSWER')
        seen.add(key)
        if record['training_eligible'] is not True or record['y'] is None:
            excluded+=1;continue
        x=record['x_base']
        if record['sample_origin']!='Q4_SURVEY' or type(record['y']) is not int or record['y'] not in (0,1):raise ValueError('INVALID_Q4_LABEL')
        if len(x)!=8 or any(type(v) not in (float,int) or not math.isfinite(v) for v in x):raise ValueError('INVALID_Q4_X8')
        # Check raw features against the unscaled export. This catches a second application of Q2/scaling.
        a=record['route_a'];b=record['route_b'];w=record['q2_weights']
        if any(len(r['raw_features'])!=6 or any(type(v) not in (float,int) or not math.isfinite(v) or v<0 for v in [r['display_duration_s'],r['distance_m'],*r['raw_features']]) for r in (a,b)):raise ValueError('INVALID_Q4_ROUTE')
        if record['answer']!=('A' if record['y']==1 else 'B'):raise ValueError('Q4_ANSWER_LABEL_MISMATCH')
        for field,expected_version in {'feature_version':'static_burden_v5_child_circle_inside','contract_version':'anjeon_contract_v6_child100','eta_version':'internal_hourly_topis_v1'}.items():
            if record['versions'].get(field)!=expected_version:raise ValueError('Q4_VERSION_MISMATCH')
        if len(w)!=6 or any(type(v) not in (float,int) or not math.isfinite(v) or v<0 for v in w) or not (math.isclose(sum(w),1,abs_tol=1e-8) or sum(w)==0):raise ValueError('INVALID_Q2_WEIGHTS')
        expected=[a['display_duration_s']-b['display_duration_s'],a['distance_m']-b['distance_m']]+[(u-v)*weight for u,v,weight in zip(a['raw_features'],b['raw_features'],w)]
        if len(expected)!=8 or any(not math.isclose(u,v,abs_tol=1e-9) for u,v in zip(x,expected)):raise ValueError('Q4_FEATURE_RECONSTRUCTION_MISMATCH')
        rows.append(dict(user_id=record['user_id'],session_id=record['session_id'],search_id=record['session_id']+':'+str(record['question_index']),
            split=user_split(record['user_id']),y=record['y'],sample_origin='Q4_SURVEY',case_set_version=record['case_set_version'],completed_at=record['completed_at'],**dict(zip(FEATURES,x))))
    if not rows:raise ValueError('NO_ELIGIBLE_Q4_RESPONSES')
    frame=pd.DataFrame(rows)
    return frame,{'training_source':'Q4_SURVEY','split_unit':'pseudonymous_user','excluded_rows':excluded,'real_user_validated':False,
        'warning':'Do not feed trial_audit into these same rows. Harmonize HMAC user IDs with service choices before combining/splitting.'}
