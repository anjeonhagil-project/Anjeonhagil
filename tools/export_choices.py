"""Export actual immutable display/choice events for the ML team. No mock labels or fitted model."""
import argparse,os,json,hashlib
from pathlib import Path
import psycopg
from psycopg.rows import dict_row
a=argparse.ArgumentParser();a.add_argument('--output',required=True);args=a.parse_args();out=Path(args.output)
if out.exists():raise SystemExit('Choose a new export path; do not overwrite recorded evidence.')
out.parent.mkdir(parents=True,exist_ok=True);counts={'train':0,'validation':0,'test':0,'single_candidate_excluded':0}
with psycopg.connect(os.environ['DATABASE_URL'],row_factory=dict_row) as db,out.open('w',encoding='utf-8') as f:
 with db.cursor(name='actual_choices') as c:
  c.execute('''SELECT ch.*, e.displayed_candidate_ids,e.exposed_at,s.departure_at,s.profile_snapshot,s.versions,
 (SELECT jsonb_agg(c.snapshot ORDER BY j.ord) FROM jsonb_array_elements_text(e.displayed_candidate_ids) WITH ORDINALITY j(id,ord) JOIN ag_candidates c ON c.candidate_id=j.id::uuid) AS snapshots
 FROM ag_choices ch JOIN ag_exposures e USING(exposure_id) JOIN ag_searches s ON s.search_id=ch.search_id
 WHERE ch.event_source='ACTUAL_USER_CHOICE' ORDER BY ch.chosen_at,ch.choice_event_id''')
  for r in c:
   if len(r['snapshots'])<2:counts['single_candidate_excluded']+=1;continue
   uid=str(r['user_id']);bucket=int(hashlib.sha256(('split_v1:'+uid).encode()).hexdigest()[:8],16)%10
   split='train' if bucket<6 else 'validation' if bucket<8 else 'test';counts[split]+=1
   for s in r['snapshots']:
    s.update(exposure_id=str(r['exposure_id']),displayed=True,departure_at=r['departure_at'].isoformat())
   record={'split':split,'split_version':'user_sha256_60_20_20_v1','profile_weights':r['profile_snapshot']['profile_weights'],'snapshots':r['snapshots'],'choice':{k:r[k] for k in ['choice_event_id','search_id','user_id','exposure_id','selected_candidate_id','chosen_at','event_source','sample_origin','exposed_at','displayed_candidate_ids']}}
   f.write(json.dumps(record,ensure_ascii=False,default=str,allow_nan=False)+'\n')
print(json.dumps({'counts':counts,'output':str(out),'note':'Fit scales on train only; add versioned scale_version/scaler_sha256 in a separate training view before api.make_training_pairs. Small user counts may leave a split empty.'},ensure_ascii=False))
