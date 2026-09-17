"""Versioned development feature adapter. Static scope only; no production permission."""
from pathlib import Path
import sys,sqlite3,json,math,collections,hashlib
P=Path(__file__).resolve().parent;B=P.parent.parent
from features import FeatureCalculator
class Calculator:
 def __init__(self):
  self.base=FeatureCalculator(B/'data/support/features.sqlite',B/'data/transitions.sqlite',B/'data/support/graph.sqlite')
  self.db=sqlite3.connect('file:'+str(B/'data/feature_policy.sqlite')+'?mode=ro',uri=True);self.db.row_factory=sqlite3.Row
  self.rt=sqlite3.connect('file:'+str(B/'data/routing.sqlite')+'?mode=ro',uri=True);self.rt.row_factory=sqlite3.Row
  self.rules=json.loads((P/'rules.json').read_text());self.no=[];self.only=collections.defaultdict(set)
  stored=self.db.execute("select value from metadata where key='rules_sha256'").fetchone()[0]
  if stored!=hashlib.sha256((P/'rules.json').read_bytes()).hexdigest():raise ValueError('rules/database version mismatch')
  p=self.rules['parameters'];self.base.params={'complex_node_degree_min':p['complex_degree'],'multilane_directional_min':p['directional_lanes'],'turn_angle_min_deg':p['unfamiliar_angle'],'action_angle_min_deg':p['action_angle'],'consecutive_max_distance_m':p['consecutive_distance_m']}
  for row in self.rt.execute('select * from restriction_sequences'):
   seq=tuple(json.loads(row['arc_ids_json']))
   if row['kind']=='no':self.no.append(seq)
   elif row['kind']=='only':
    for n in range(1,len(seq)):self.only[(row['relation_id'],seq[:n])].add(seq[n])
   else:raise ValueError('unsupported restriction kind')
 def check_sequences(self,aids):
  seq=tuple(aids)
  for ban in self.no:
   for i in range(len(seq)-len(ban)+1):
    if seq[i:i+len(ban)]==ban:raise ValueError('prohibited turn sequence')
  for (_,prefix),allowed in self.only.items():
   for i in range(len(seq)-len(prefix)):
    if seq[i:i+len(prefix)]==prefix and seq[i+len(prefix)] not in allowed:raise ValueError('only-turn sequence violation')
 def calculate(self,segments):
  if any(not isinstance(s.get('arc_id'),int) or isinstance(s.get('arc_id'),bool) for s in segments):raise ValueError('arc id must be integer')
  result=self.base.calculate(segments);aids=[s['arc_id'] for s in segments];self.check_sequences(aids)
  nsum=msum=nu=mu=nest=mest=eta=eta_unknown=0.;nb=collections.Counter();mb=collections.Counter();ebs=collections.Counter()
  for s in segments:
   arc=self.rt.execute('select * from arcs where arc_id=?',(s['arc_id'],)).fetchone()
   e=self.db.execute('select * from edge_policy where edge_id=?',(arc['edge_id'],)).fetchone();a=self.db.execute('select * from arc_policy where arc_id=?',(s['arc_id'],)).fetchone()
   if not arc['static_eligible'] or not a['eligible'] or not e['eligible']:raise ValueError('outside static supported routing scope')
   length=arc['length_m']*(s.get('end_fraction',1)-s.get('start_fraction',0))
   if e['narrow_score'] is None:nu+=length
   else:nsum+=length*e['narrow_score'];nest+=length*e['is_estimated']
   if a['merge_score'] is None:mu+=length
   else:msum+=length*a['merge_score'];mest+=length*a['merge_estimated']
   nb[e['basis']]+=length;mb[a['merge_basis']]+=length
   ebs[a['eta_basis']]+=length
   if a['eta_dev_seconds'] is None:eta_unknown+=length
   else:eta+=a['eta_dev_seconds']*(s.get('end_fraction',1)-s.get('start_fraction',0))
  result['raw_features'][1]=None if mu else msum;result['raw_features'][2]=None if nu else nsum
  result.update(eta_dev_seconds=None if eta_unknown else eta,eta_unknown_length_m=eta_unknown,eta_source_lengths_m=dict(ebs),feature_version=self.rules['feature_version'],unknown_narrow_length_m=nu,unknown_merge_length_m=mu,known_merge_length_m=msum,known_narrow_score_length_m=nsum,narrow_estimated_length_m=nest,merge_estimated_length_m=mest,narrow_basis_lengths_m=dict(nb),merge_basis_lengths_m=dict(mb),all_six_computable=all(x is not None and math.isfinite(x) for x in result['raw_features']),static_scope_checked=True,development_rules_adopted=True,eligible_for_model_training=None,training_gate='REQUIRES_REAL_CHOICE_LOG_AND_VERSION_COMPATIBILITY',permission='STATIC_SCOPE_ONLY_NOT_LIVE_SERVICE_CLEARANCE')
  return result
