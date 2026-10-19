import unittest
import numpy as np
from scipy import sparse
from evaluate import ridge_fit, loss, macro, evaluate, intervals
class ExperimentTests(unittest.TestCase):
 def test_ridge_learns_signal_and_shrinks(self):
  x=sparse.csr_matrix([[-1.],[-1.],[1.],[1.]])
  y=np.array([0,0,1,1]);o=np.zeros(4)
  w=ridge_fit(x,y,o,.1); strong=ridge_fit(x,y,o,100)
  self.assertGreater(w[0],0);self.assertLess(abs(strong[0]),abs(w[0]))
 def test_macro_gives_equal_weight_to_bills(self):
  self.assertEqual(macro(np.array([0.,0.,1.]),['a','a','b']),.5)
  self.assertTrue(np.isfinite(loss(np.array([0,1]),np.array([1.,0.]))).all())
 def test_empty_split_fails_closed(self):
  r=evaluate({'rows':[{'y':1,'partition':'train'}],'texts':{}})
  self.assertEqual(r['status'],'HOLD_EMPTY_CHRONOLOGICAL_PARTITION')
 def test_cluster_bootstrap_is_seeded_and_paired(self):
  rows=[{'bill':str(i//2)} for i in range(20)];y=np.array([0,1]*10)
  p=np.array([.2,.8]*10);base=np.full(20,.5)
  a=intervals(rows,y,p,base);b=intervals(rows,y,p,base)
  self.assertEqual(a,b);self.assertLess(a['billMacroLogLoss']['upper95'],0)

class ChronologyTests(unittest.TestCase):
 def test_test_labels_cannot_change_selected_model(self):
  rows=[]
  for partition,year in [('train',2021),('validation',2023),('test',2024)]:
   for i in range(64):
    rows.append({'partition':partition,'day':str(year)+'-03-01','bill':partition+str(i//2),'person':str(i%8),'party':'A' if i%2 else 'B','textKey':'a' if i%2 else 'b','y':i%2})
  data={'rows':rows,'texts':{'a':'health care funding public schools','b':'lower taxes local control'},'protocolSha256':'synthetic','cohortSha256':'synthetic'}
  first=evaluate(data)
  for r in rows:
   if r['partition']=='test':r['y']=1-r['y']
  second=evaluate(data)
  self.assertEqual(first['selectedLambda'],second['selectedLambda'])
  self.assertEqual(first['validationGrid'],second['validationGrid'])

if __name__=='__main__':unittest.main()
