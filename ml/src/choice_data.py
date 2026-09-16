"""Read immutable real-choice JSONL; exclude Q4/study/single-card events and generate reproducible A/B pairs."""
import hashlib,json,random
from pathlib import Path
import pandas as pd
from features import candidate_vector,FEATURES
from split import user_split

def load_choices(path):
    rows=[];seen=set();excluded=0
    for line in Path(path).read_text(encoding='utf-8-sig').splitlines():
        if not line.strip():continue
        record=json.loads(line);choice=record['choice']
        if choice['sample_origin']!='service' or choice['event_source']!='ACTUAL_USER_CHOICE':
            excluded+=1;continue
        event=str(choice['choice_event_id']);search=str(choice['search_id']);user=str(choice['user_id'])
        if search in seen:raise ValueError('DUPLICATE_SEARCH')
        seen.add(search)
        snapshots=record['snapshots'];ids=[str(c['candidate_id']) for c in snapshots]
        displayed=list(map(str,choice['displayed_candidate_ids']));chosen=str(choice['selected_candidate_id'])
        if len(ids)!=len(set(ids)) or set(ids)!=set(displayed) or len(displayed)!=len(ids) or chosen not in ids:
            raise ValueError('EXPOSURE_MISMATCH')
        if len(ids)<2:excluded+=1;continue
        if len(ids)>3:raise ValueError('SERVICE_CARD_LIMIT')
        split=user_split(user)
        if record['split']!=split:raise ValueError('USER_SPLIT_MISMATCH')
        vectors={}
        for c in snapshots:
            if str(c['search_id'])!=search or str(c['user_id'])!=user or not c.get('displayed') or str(c['exposure_id'])!=str(choice['exposure_id']):
                raise ValueError('SNAPSHOT_OWNERSHIP_MISMATCH')
            if c['feature_version']!='static_burden_v5_child_circle_inside' or c['contract_version']!='anjeon_contract_v6_child100':
                raise ValueError('SNAPSHOT_VERSION_MISMATCH')
            if c['profile_weights']!=record['profile_weights']:raise ValueError('SNAPSHOT_WEIGHTS_MISMATCH')
            vectors[str(c['candidate_id'])]=candidate_vector(c,record['profile_weights'])
        rng=random.Random(int(hashlib.sha256(('pair_v1:'+event).encode()).hexdigest(),16))
        for other in ids:
            if other==chosen:continue
            a,b=(chosen,other) if rng.getrandbits(1) else (other,chosen)
            x=[u-v for u,v in zip(vectors[a],vectors[b])]
            rows.append(dict(user_id=user,search_id=search,exposure_id=str(choice['exposure_id']),choice_event_id=event,
                split=split,a=a,b=b,y=int(a==chosen),sample_weight=1/(len(ids)-1),**dict(zip(FEATURES,x))))
    if not rows:raise ValueError('NO_ELIGIBLE_REAL_CHOICES')
    return pd.DataFrame(rows),{'training_source':'ACTUAL_USER_CHOICE','split_unit':'user','excluded_events':excluded}
