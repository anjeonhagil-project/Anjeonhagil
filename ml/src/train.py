"""Reproduce the deployed LR or train a separate real-choice candidate; never auto-activate artifacts."""
from pathlib import Path
import argparse,hashlib,json
from datetime import datetime,timezone
from logistic_model import load_dataset,make_pipeline,FEATURES
from choice_data import load_choices
from split import validate_splits
from evaluate import evaluate
from inference import ChoiceModel
from xgboost_model import BundledXGBoost
ROOT=Path(__file__).resolve().parents[2]
def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--csv',type=Path,default=ROOT/'ml/data/synthetic_pairwise.csv')
    parser.add_argument('--choices',type=Path)
    parser.add_argument('--output',type=Path,default=ROOT/'ml/artifacts/training-run')
    args=parser.parse_args()
    source=args.choices or args.csv
    if args.choices:frame,metadata=load_choices(source)
    else:
        frame,_=load_dataset(source)
        metadata={'training_source':'SYNTHETIC_TEAM_DATA','split_unit':'synthetic_search_not_real_user'}
    validate_splits(frame)
    train=frame[frame.split=='train']
    if set(train.y)!={0,1}:raise ValueError('TRAIN_REQUIRES_BOTH_LABELS')
    params=dict(C=100,penalty='l1',solver='liblinear',class_weight='balanced',max_iter=1000)
    pipeline=make_pipeline(params,42)
    weights=1/train.groupby('search_id').search_id.transform('count').to_numpy(float)
    pipeline.fit(train[FEATURES].to_numpy(float),train.y,model__sample_weight=weights)
    results={split:evaluate(pipeline,frame[frame.split==split]) for split in ['validation','test']}
    bundle=ChoiceModel()
    comparison={}
    if not args.choices and bundle.xgb is not None:
        comparison={split:evaluate(BundledXGBoost(bundle),frame[frame.split==split]) for split in ['validation','test']}
    stamp=datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    artifact={k:bundle.spec[k] for k in ['feature_version','contract_version','eta_version','probability','ranking']}
    artifact.update(model_version='logistic_candidate_'+stamp,scaler_version='train_std_'+stamp,**metadata,
        real_user_validated=False,feature_order=FEATURES,coefficients=pipeline.named_steps['model'].coef_[0].tolist(),
        scales=pipeline.named_steps['scaler'].scale_.tolist(),intercept=0,with_mean=False,test_metrics=results['test'])
    manifest={**metadata,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'hyperparameters':params,'seed':42,
        'scaler_fit_split':'train','counts':frame.groupby('split').size().to_dict(),'logistic':results,
        'bundled_xgboost_comparison':comparison,'automatically_activated':False,
        'limitation':'Synthetic metrics do not establish real-user preference accuracy or accident safety.'}
    args.output.mkdir(parents=True,exist_ok=True)
    for name,value in [('logistic.json',artifact),('metrics.json',manifest)]:
        (args.output/name).write_text(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf8')
    print(json.dumps({'output':str(args.output),'logistic':results,'activated':False},indent=2))
if __name__=='__main__':main()
