"""Current hourly service API. Legacy static examples import legacy_static_api explicitly."""
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent/'runtime'))
from routing_service import RouteService,VERSIONS
from learning import FACTOR_ORDER,UNITS,survey_weights,pair_x8,make_training_pairs,scaler_hash,versions
class TeamCalculator:
 def __init__(self):
  from load_database import verify_files
  verify_files();self.engine=RouteService()
 def evaluate(self,request):
  versions(request)
  return self.engine.evaluate(request['segments'],request['departure_at'])
__all__=['TeamCalculator','RouteService','VERSIONS','FACTOR_ORDER','UNITS','survey_weights','pair_x8','make_training_pairs','scaler_hash']
