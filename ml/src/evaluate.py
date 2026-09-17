"""Evaluate weighted pair metrics and probability-sum Top1 for 2 or 3 displayed candidates."""
import numpy as np
from sklearn.metrics import accuracy_score,roc_auc_score,log_loss
from inference import FEATURES
def symmetric_probability(model,x):
    x=np.atleast_2d(x)
    return (model.predict_proba(x)[:,1]+1-model.predict_proba(-x)[:,1])/2

def evaluate(model,frame):
    if frame.empty:raise ValueError('EMPTY_EVALUATION_SPLIT')
    x=frame[FEATURES].to_numpy(float);y=frame.y.to_numpy(int)
    weights=1/frame.groupby('search_id').search_id.transform('count').to_numpy(float)
    p=symmetric_probability(model,x);hits=0;searches=0
    for search,group in frame.groupby('search_id',sort=False):
        rows=list(group.itertuples(index=False));vectors={str(rows[0].a):np.zeros(8)}
        for _ in range(3):
            for row in rows:
                a,b=str(row.a),str(row.b);v=np.array([getattr(row,f) for f in FEATURES])
                if a in vectors:vectors[b]=vectors[a]-v
                elif b in vectors:vectors[a]=vectors[b]+v
        ids=sorted(set(str(v) for v in [*group.a,*group.b]))
        if len(ids) not in (2,3) or set(vectors)!=set(ids):raise ValueError('DISCONNECTED_PAIRS')
        chosen={str(row.a if row.y==1 else row.b) for row in rows}
        if len(chosen)!=1:raise ValueError('CONTRADICTORY_CHOICE')
        scores={i:0. for i in ids}
        for n,a in enumerate(ids):
            for b in ids[n+1:]:
                probability=float(symmetric_probability(model,vectors[a]-vectors[b])[0])
                scores[a]+=probability;scores[b]+=1-probability
        predicted=max(ids,key=lambda i:scores[i]);hits+=int(predicted in chosen);searches+=1
    return {'rows':len(frame),'searches':searches,'pair_accuracy':float(accuracy_score(y,p>=.5,sample_weight=weights)),
        'roc_auc':float(roc_auc_score(y,p,sample_weight=weights)) if len(set(y))==2 else None,
        'log_loss':float(log_loss(y,p,labels=[0,1],sample_weight=weights)),
        'top1_accuracy':hits/searches,'top1_hits':hits,'top1_searches':searches,'metrics_weighting':'one_per_search'}
