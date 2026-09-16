"""Source-tag semantics, not a validated driving-difficulty classifier."""
import re

def lane_count(value):
 if value is None:return None
 s=str(value).strip()
 return int(s) if re.fullmatch(r'[1-9]\d*',s) else None

def lanes(tags,reverse,oneway_dir):
 key='lanes:backward' if reverse else 'lanes:forward'
 vals={k:lane_count(tags.get(k)) for k in ['lanes','lanes:forward','lanes:backward','lanes:both_ways']}
 total=vals['lanes'];f=vals['lanes:forward'];b=vals['lanes:backward'];both=vals['lanes:both_ways']
 out={'directional_count':None,'at_least_3':None,'status':'unknown','source_key':None}
 if any(k.startswith('lanes') and ':conditional' in k for k in tags):return dict(out,status='conditional_requires_time')
 if any(k in tags and vals[k] is None for k in vals):return dict(out,status='unparsed_or_invalid')
 if total is not None and (sum(v or 0 for v in [f,b,both])>total):return dict(out,status='conflicting_counts')
 v=vals[key]
 if v is not None:return dict(out,directional_count=v,at_least_3=v>=3,status='explicit_direction',source_key=key)
 if oneway_dir in ['forward','reverse'] and total is not None:return dict(out,directional_count=total,at_least_3=total>=3,status='oneway_total',source_key='lanes')
 if total is not None and total<=2:return dict(out,at_least_3=False,status='total_upper_bound_only',source_key='lanes')
 return out

def width(tags):
 raw=tags.get('width');m=re.fullmatch(r'\s*(\d+(?:\.\d+)?)\s*(?:m)?\s*',str(raw)) if raw is not None else None
 value=float(m[1]) if m else None
 if value is not None and value<=0:value=None
 return {'raw':raw,'road_width_tag_m':value,'status':'parsed_tag_not_field_verified' if value is not None else 'unknown' if raw is None else 'unparsed_or_invalid','source_width':tags.get('source:width'),'effective_driving_width_m':None,'final_narrow_score':None,'reason':'effective_width_and_classifier_not_validated'}
