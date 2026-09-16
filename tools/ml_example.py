"""SYNTHETIC EXPLANATION ONLY. These are not collected human choices."""
import json
from legacy_static_api import VERSIONS,FACTOR_ORDER,UNITS,survey_weights,scaler_hash,pair_x8,make_training_pairs
weights=survey_weights([2,0,1,0,0,3])
scaler={'scale_version':'EXAMPLE_ONLY','feature_version':VERSIONS['feature_version'],'fit_split':'train','fit_manifest_sha256':'0'*64,'values':[60,1000,1,100,100,1,1,100]}
common={**VERSIONS,'factor_order':FACTOR_ORDER,'units':UNITS,'user_id':'EXAMPLE_USER','search_id':'EXAMPLE_SEARCH','exposure_id':'EXAMPLE_EXPOSURE','profile_version':'EXAMPLE_PROFILE','model_version':'EXAMPLE_MODEL','scale_version':scaler['scale_version'],'scaler_sha256':scaler_hash(scaler),'profile_weights':weights,'displayed':True,'display_duration_source':'INTERNAL_STATIC'}
a={**common,'candidate_id':'A','display_duration_s':600,'distance_m':3000,'raw_features':[2,300,500,1,2,200]}
b={**common,'candidate_id':'B','display_duration_s':660,'distance_m':3200,'raw_features':[1,400,300,0,1,100]}
# The event_source below exercises the contract. It does not certify a real human.
choice={'event_source':'ACTUAL_USER_CHOICE','choice_event_id':'SYNTHETIC_EXAMPLE_ONLY','search_id':common['search_id'],'user_id':common['user_id'],'exposure_id':common['exposure_id'],'displayed_candidate_ids':['A','B'],'selected_candidate_id':'A','exposed_at':'2026-09-15T09:00:00+09:00','chosen_at':'2026-09-15T09:00:10+09:00'}
print(json.dumps({'purpose':'SYNTHETIC_EXPLANATION_NOT_TRAINING','weights':weights,'scaler':scaler,'snapshots':[a,b],'choice':choice,'pairs':make_training_pairs([a,b],choice,weights,scaler)},ensure_ascii=False,indent=2))
