"""Export the preserved static reference graph and restriction history rules.
No calendar/conditional clearance is inferred by this exporter.
"""
from pathlib import Path
import sqlite3,json,sys
B=Path(__file__).resolve().parent.parent;up=B/'src/upstream'
s=(up/'run_od12.py').read_text().split('N=sorted(nids)')[0]
s=s.replace('from scipy.sparse import csr_matrix','').replace('from scipy.sparse.csgraph import connected_components','')
s=s.replace("B/'raw_tags_access_audit.json'","B.parent.parent/'inputs/osm_tags.json'")
s=s.replace("(O/'raw_tags_access_audit.json').write_text(json.dumps({'ways':ways,'nodes':nodes,'relations':rels},ensure_ascii=False))",'pass')
sys.argv=['run_od12.py','--roads',str(B/'inputs/roads.gpkg'),'--outdir',str(B/'verification')]
env={'__name__':'preserved_graph_export','__file__':str(up/'run_od12.py')};exec(compile(s,str(up/'run_od12.py'),'exec'),env)
c=sqlite3.connect(':memory:');c.executescript('CREATE TABLE nodes(node_id INTEGER PRIMARY KEY,x_5186 REAL,y_5186 REAL); CREATE TABLE arcs(arc_id INTEGER PRIMARY KEY,edge_id INTEGER,osm_way_id INTEGER,from_node INTEGER,to_node INTEGER,length_m REAL,static_eligible INTEGER,raw_access_status TEXT); CREATE TABLE restriction_sequences(relation_id INTEGER,kind TEXT,arc_ids_json TEXT); CREATE TABLE relation_holds(relation_id INTEGER,arc_id INTEGER,reason TEXT); CREATE TABLE metadata(key TEXT PRIMARY KEY,value TEXT);')
c.executemany('insert into nodes values(?,?,?)',[(n,*xy) for n,xy in env['xy'].items()])
c.executemany('insert into arcs values(?,?,?,?,?,?,?,?)',[(a['id'],a['edge'],a['way'],a['s'],a['t'],a['length'],int(a['id'] in env['active']),a['status']) for a in env['arcs'].values()])
c.executemany('insert into restriction_sequences values(?,?,?)',[(rid,k,json.dumps(p)) for rid,k,p in env['seqs']])
for r in env['reviews']:
 for a in r['held_arc_ids']:c.execute('insert into relation_holds values(?,?,?)',(r['relation_id'],a,r['reason']))
c.execute('insert into metadata values(?,?)',('scope','static reference graph; conditional/unknown rules held; apply additional quality flags'))
c.commit();(B/'data/routing.sqlite').write_bytes(c.serialize())
summary={'nodes':len(env['xy']),'arcs':len(env['arcs']),'static_eligible_arcs':len(env['active']),'restriction_sequence_rows':len(env['seqs']),'review_relations':len(env['reviews']),'conditional_release':False}
(B/'verification/routing_export.json').write_text(json.dumps(summary,indent=2));print(summary)
