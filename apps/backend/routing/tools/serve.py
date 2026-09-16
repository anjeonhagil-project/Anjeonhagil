"""Private local routing worker. Node backend calls it; bind loopback by default."""
from pathlib import Path
import sys,json,os,hmac,hashlib
from http.server import HTTPServer,BaseHTTPRequestHandler
sys.path.insert(0,str(Path(__file__).resolve().parent/'runtime'))
from routing_service import VERSIONS
from integrated_service import IntegratedService
from personalize import adapt
from learning import versions
ROOT=Path(__file__).resolve().parent.parent
# Check all supplied dataset hashes before serving. The manifest is generated at packaging.
def verify():
 p=ROOT/'service_manifest.json'
 if not p.is_file():raise RuntimeError('service_manifest.json required')
 data_files={k:v for k,v in json.loads(p.read_text())['files'].items() if not k.endswith('.py')}
 runtime=json.loads((ROOT/'runtime_manifest.json').read_text())
 for name,expected in {**data_files,**runtime['files']}.items():
  f=(ROOT/name).resolve()
  if not f.is_relative_to(ROOT.resolve()) or not f.is_file():raise RuntimeError('dataset path missing')
  with f.open('rb') as r:actual=hashlib.file_digest(r,'sha256').hexdigest()
  if actual!=expected:raise RuntimeError('dataset hash mismatch: '+name)
verify();engine=IntegratedService();token=os.environ.get('ROUTING_WORKER_TOKEN','')
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def reply(self,status,value):
  b=json.dumps(value,ensure_ascii=False,allow_nan=False).encode();self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
 def authorized(self):return not token or hmac.compare_digest(self.headers.get('Authorization',''),'Bearer '+token)
 def do_GET(self):
  if not self.authorized():return self.reply(401,{'error':'worker authentication required'})
  if self.path=='/health':return self.reply(200,{'ok':True,'versions':VERSIONS,'model':engine.model.status(),'mapped_arcs':sum(r['matched'] for r in engine.clock.mapping.values())})
  return self.reply(404,{'error':'not found'})
 def do_POST(self):
  if not self.authorized():return self.reply(401,{'error':'worker authentication required'})
  try:
   length=int(self.headers.get('Content-Length','0'))
   if not 0<length<=2000000:return self.reply(413,{'error':'body size invalid'})
   req=json.loads(self.rfile.read(length));
   if self.path=='/search':answer=engine.search(req)
   elif self.path=='/guidance':
    versions(req)
    from guidance import build_guidance
    from routing_service import graph
    answer=build_guidance(engine,graph,req['segments'])
   elif self.path=='/rank':answer=engine.model.rank(req['candidates'],req['weights'],comparison=True)
   elif self.path=='/personalize':answer=adapt(engine.model,req)
   elif self.path=='/evaluate':
    versions(req);answer=engine.evaluate(req['segments'],req['departure_at'])
   else:return self.reply(404,{'error':'not found'})
   self.reply(200,answer)
  except (ValueError,KeyError,TypeError) as e:self.reply(422,{'error':str(e)})
  except RuntimeError as e:self.reply(503,{'error':str(e)})
  except Exception as e:self.reply(500,{'error':'ROUTING_INTERNAL_ERROR'});print(type(e).__name__,str(e),file=sys.stderr,flush=True)
host=os.environ.get('ROUTING_WORKER_HOST','127.0.0.1')
if host not in ['127.0.0.1','localhost'] and not token:raise RuntimeError('non-loopback worker requires ROUTING_WORKER_TOKEN')
port=int(os.environ.get('ROUTING_WORKER_PORT','8100'));print(json.dumps({'ready':True,'host':host,'port':port,'versions':VERSIONS}),flush=True);HTTPServer((host,port),Handler).serve_forever()
