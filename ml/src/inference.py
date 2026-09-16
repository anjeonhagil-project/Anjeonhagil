"""공통 모델 추론: 사용자의 6weights를 X2~X7에 반영하고 대칭 pair 확률의 합으로 정렬한다."""
from pathlib import Path
import hashlib, json, math

BUNDLE = Path(__file__).resolve().parents[1] / 'bundled'
FEATURES = ['time_diff','distance_diff','intersection_weighted_diff','merge_weighted_diff','narrow_weighted_diff','turn_weighted_diff','consecutive_weighted_diff','child_100m_weighted_diff']

class ChoiceModel:
    def __init__(self, bundle=BUNDLE):
        self.available=False; self.load_error=None; self.sha256=None
        # 모델 장애 때만 쓰는 기존 설문 비교 단위이며 학습 모델/확률로 표시하지 않는다.
        self.spec={'model_version':'survey_only_v1','scaler_version':None,'training_source':'SURVEY_RULE',
            'real_user_validated':False,'test_metrics':{},'feature_version':'static_burden_v5_child_circle_inside',
            'contract_version':'anjeon_contract_v6_child100','eta_version':'internal_hourly_topis_v1',
            'scales':[300.,1000.,10.,1000.,1000.,10.,10.,1000.]}
        try:
            self.raw=(bundle/'logistic.json').read_bytes();spec=json.loads(self.raw)
            if len(spec['scales'])!=8 or len(spec['coefficients'])!=8 or spec['intercept']!=0 or spec['with_mean'] is not False:raise ValueError('MODEL_SCHEMA')
            if spec['feature_order'] != FEATURES:raise ValueError('MODEL_FEATURE_ORDER')
            if any(not math.isfinite(v) or v<=0 for v in spec['scales']) or any(not math.isfinite(v) for v in spec['coefficients']):raise ValueError('MODEL_VALUES')
            if any(spec[k]!=self.spec[k] for k in ('feature_version','contract_version','eta_version')):raise ValueError('MODEL_VERSION')
            self.spec=spec;self.sha256=hashlib.sha256(self.raw).hexdigest();self.available=True
        except (OSError,ValueError,KeyError,TypeError) as error:self.load_error=type(error).__name__
        self.xgb = None
        self.xgb_error = None
        try:
            import xgboost as xgb
            self.xgb = xgb.Booster()
            self.xgb.load_model(bundle / 'xgboost.json')
            self.xgb_spec = json.loads((bundle / 'xgboost-metadata.json').read_text())
        except Exception as error:
            self.xgb = None
            self.xgb_error = type(error).__name__

    def status(self):
        return {**{k: self.spec[k] for k in ['model_version','scaler_version','training_source','real_user_validated','test_metrics','feature_version','contract_version','eta_version']},
                'available':self.available,'load_error':self.load_error,
                'artifact_sha256': self.sha256, 'scaler_sha256': hashlib.sha256(json.dumps(self.spec['scales'], separators=(',', ':')).encode()).hexdigest() if self.available else None,
                'xgboost_available': self.xgb is not None, 'xgboost_error': self.xgb_error}

    def pair(self, a, b, weights):
        # X0와 화면에 보인 시간은 같은 반올림된 초를 사용한다. X1은 m, X2~7은 raw6 × 적용 weights.
        av = [a['display_duration_s'], a['distance_m'], *a['raw_features']]
        bv = [b['display_duration_s'], b['distance_m'], *b['raw_features']]
        if len(av)!=8 or len(bv)!=8:raise ValueError('MODEL_FEATURE_COUNT')
        x = [(u-v)*w for u,v,w in zip(av,bv,[1.,1.,*weights])]
        if not all(math.isfinite(v) for v in x): raise ValueError('MODEL_NONFINITE_FEATURE')
        return x

    def probability(self, x):
        z = sum(v/s*c for v,s,c in zip(x,self.spec['scales'],self.spec['coefficients']))
        return 1/(1+math.exp(-z)) if z >= 0 else math.exp(z)/(1+math.exp(z))

    def rank(self, candidates, weights, comparison=False):
        if len(weights) != 6 or any(type(w) not in (int,float) or not math.isfinite(w) or w < 0 for w in weights): raise ValueError('INVALID_PROFILE_WEIGHTS')
        if not (math.isclose(sum(weights),1,abs_tol=1e-8) or sum(weights)==0): raise ValueError('INVALID_WEIGHT_SUM')
        if not 1 <= len(candidates) <= 12: raise ValueError('INVALID_CANDIDATE_COUNT')
        for candidate in candidates:
            self.pair(candidate, candidate, weights)
            values = [candidate['display_duration_s'],candidate['internal_duration_s'],candidate['distance_m'],*candidate['raw_features']]
            if any(type(v) not in (int,float) or not math.isfinite(v) or v<0 for v in values):raise ValueError('MODEL_INVALID_FEATURE')
        if not self.available:
            costs=[sum(v*w/s for v,w,s in zip(c['raw_features'],weights,self.spec['scales'][2:])) for c in candidates]
            order=sorted(range(len(candidates)),key=lambda i:(costs[i],candidates[i]['internal_duration_s'],candidates[i]['distance_m'],i))
            return {'order':order,'recommended_index':order[0],'scores':[-v for v in costs],'pairs':[], 'model':self.status(),'comparison_scores':None}
        scores = [0.] * len(candidates); xgb_scores = [0.] * len(candidates); pairs = []
        for i in range(len(candidates)):
            for j in range(i+1,len(candidates)):
                x = self.pair(candidates[i], candidates[j], weights)
                p = (self.probability(x) + 1 - self.probability([-v for v in x]))/2
                scores[i] += p; scores[j] += 1-p
                pairs.append({'a':i,'b':j,'p_a':p})
                if comparison and self.xgb is not None:
                    import numpy as np
                    import xgboost as xgb
                    scaled = np.asarray([x,[-v for v in x]],dtype=np.float32) / self.xgb_spec['scale']
                    pred = self.xgb.predict(xgb.DMatrix(scaled,feature_names=self.spec['feature_order']))
                    xp = float((pred[0]+1-pred[1])/2)
                    xgb_scores[i] += xp; xgb_scores[j] += 1-xp
        order = sorted(range(len(candidates)),key=lambda i:(-scores[i],candidates[i]['internal_duration_s'],candidates[i]['distance_m'],i))
        return {'order':order,'recommended_index':order[0],'scores':scores,'pairs':pairs,'model':self.status(),
                'comparison_scores':xgb_scores if comparison and self.xgb is not None else None}
