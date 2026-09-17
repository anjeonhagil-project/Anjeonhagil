import json,sys,tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'ml/src'))
from q4_data import load_q4
source=root/'.test-tools/q4-export-qa/output/q4-training.json'
frame,metadata=load_q4(source)
assert len(frame)==7 and frame.groupby('user_id')['split'].nunique().max()==1
assert metadata['excluded_rows']==1 and metadata['real_user_validated'] is False
data=json.loads(source.read_text(encoding='utf8'))
with tempfile.TemporaryDirectory(dir=root/'.test-tools') as directory:
    path=Path(directory)/'tampered.json'
    data['rows'][0]['x_base'][0]+=1
    path.write_text(json.dumps(data),encoding='utf8')
    try:load_q4(path);raise AssertionError('Tampered X accepted')
    except ValueError as error:assert 'RECONSTRUCTION' in str(error)
print(json.dumps({'passed':4,'scope':'Q4 Python loader, UNSURE filtering, user grouping, X reconstruction; automated fixture, no training'}))
