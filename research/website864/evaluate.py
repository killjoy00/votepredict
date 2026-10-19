"""Frozen v2, isolated website-text experiment. No DB/network/model artifacts."""
import json, sys, hashlib, warnings
import numpy as np
from scipy.special import expit
from scipy.optimize import minimize
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import roc_auc_score, balanced_accuracy_score

GRID = [0.1, 1, 10, 100]

def loss(y, p):
    p = np.clip(p, 1e-6, 1-1e-6)
    return -(y*np.log(p)+(1-y)*np.log1p(-p))

def groups(values):
    unique, inverse = np.unique(np.asarray(values), return_inverse=True)
    return unique, inverse, np.bincount(inverse)

def macro(values, keys):
    _, inv, count = groups(keys)
    return float(np.mean(np.bincount(inv, weights=values)/count))

def metrics(rows, y, p):
    return {'memberTargets':len(rows), 'bills':len(set(r['bill'] for r in rows)),
        'yea':int(y.sum()), 'nay':int(len(y)-y.sum()),
        'billMacroLogLoss':macro(loss(y,p), [r['bill'] for r in rows]),
        'billMacroBrier':macro((y-p)**2, [r['bill'] for r in rows]),
        'microLogLoss':float(np.mean(loss(y,p))), 'microBrier':float(np.mean((y-p)**2)),
        'memberMacroBrier':macro((y-p)**2, [r['person'] for r in rows]),
        'balancedAccuracy':float(balanced_accuracy_score(y, p>=0.5)) if len(set(y))==2 else None,
        'auroc':float(roc_auc_score(y,p)) if len(set(y))==2 else None}

def ridge_fit(x, y, offset, lam):
    def objective(w):
        z = x @ w + offset
        f = np.mean(np.logaddexp(0,z)-y*z) + lam*np.dot(w,w)/2
        g = np.asarray(x.T @ (expit(z)-y)).ravel()/len(y) + lam*w
        return float(f), g
    fit = minimize(objective, np.zeros(x.shape[1]), method='L-BFGS-B', jac=True,
                   options={'maxiter':1000,'ftol':1e-9,'gtol':1e-9})
    if not fit.success or not np.isfinite(fit.fun):
        raise ValueError('Frozen ridge optimizer did not converge')
    return fit.x

def intervals(rows, y, text, party):
    _, inv, count=groups([r['bill'] for r in rows]); n=len(count)
    delta=np.column_stack((np.bincount(inv,weights=loss(y,text)-loss(y,party))/count,
                           np.bincount(inv,weights=(y-text)**2-(y-party)**2)/count))
    rng=np.random.default_rng(864)
    draws=np.asarray([delta[rng.integers(0,n,n)].mean(axis=0) for _ in range(2000)])
    return {name:{'textMinusParty':float(delta[:,i].mean()),'lower95':float(np.quantile(draws[:,i],.025)),
                  'upper95':float(np.quantile(draws[:,i],.975))}
            for i,name in enumerate(['billMacroLogLoss','billMacroBrier'])}

def evaluate(data):
    rows=data['rows']; texts=data['texts']
    if not rows or len(rows)>200000 or any(r['y'] not in [0,1] for r in rows):
        raise ValueError('Bounded binary targets required')
    index={part:np.array([i for i,r in enumerate(rows) if r['partition']==part]) for part in ['train','validation','test']}
    if any(len(a)==0 for a in index.values()):
        return {'status':'HOLD_EMPTY_CHRONOLOGICAL_PARTITION','counts':{k:len(v) for k,v in index.items()}}
    y=np.array([r['y'] for r in rows]); train=index['train']; val=index['validation']
    if len(set(y[train]))!=2:
        return {'status':'HOLD_TRAINING_HAS_ONE_CLASS'}
    overall=(float(y[train].sum())+1)/(len(train)+2)
    rates={party:(float(sum(y[i] for i in train if rows[i]['party']==party))+1)/
                    (sum(rows[i]['party']==party for i in train)+2)
           for party in set(rows[i]['party'] for i in train)}
    party=np.array([rates.get(r['party'],overall) for r in rows]); offset=np.log(party/(1-party))
    vectorizer=TfidfVectorizer(lowercase=True,strip_accents=None,ngram_range=(1,2),min_df=2,
                              max_features=5000,sublinear_tf=True,norm='l2')
    corpus=[texts[r['textKey']] for r in rows]
    vectorizer.fit([corpus[i] for i in train]); x=vectorizer.transform(corpus)
    candidates=[]
    for lam in GRID:
        w=ridge_fit(x[train],y[train],offset[train],lam)
        p=expit(x[val]@w+offset[val])
        score=macro(loss(y[val],p),[rows[i]['bill'] for i in val]); candidates.append((lam,score,w))
    best=min(s for _,s,_ in candidates)
    lam,_,w=max((c for c in candidates if c[1]<=best+1e-10), key=lambda c:c[0])
    # Fit remains train-only after validation selection; test never influences weights.
    text=expit(x@w+offset)
    out={'status':'EXECUTED_ISOLATED_NON_SERVING','selectedLambda':lam,
         'validationGrid':[{'lambda':a,'billMacroLogLoss':b} for a,b,_ in candidates],
         'vocabularySize':len(vectorizer.vocabulary_), 'partitions':{},'testByYear':{},
         'protocolSha256':data['protocolSha256'],'cohortSha256':data['cohortSha256'],
         'noFittedWeightsOrPrivateRowsExported':True, 'negativeDeltaFavorsText':True,
         'interpretation':'Website-only associations may reflect member identity/style; no bill-specific policy or causal inference.'}
    for part, ids in index.items():
        rr=[rows[i] for i in ids]; yy=y[ids]
        out['partitions'][part]={'overall':metrics(rr,yy,np.full(len(ids),overall)),
             'party':metrics(rr,yy,party[ids]),'text':metrics(rr,yy,text[ids]),
             'exploratoryInsufficientCoverage':len(set(r['bill'] for r in rr))<30 or min(int(yy.sum()),int(len(yy)-yy.sum()))<20}
        if part=='test': out['partitions'][part]['pairedBillBootstrap2000']=intervals(rr,yy,text[ids],party[ids])
    for year in [2024,2025]:
        ids=np.array([i for i in index['test'] if rows[i]['day'].startswith(str(year))])
        if len(ids):
            rr=[rows[i] for i in ids];out['testByYear'][str(year)]={
                'party':metrics(rr,y[ids],party[ids]),'text':metrics(rr,y[ids],text[ids]),
                'pairedBillBootstrap2000':intervals(rr,y[ids],text[ids],party[ids])}
    return out

if __name__=='__main__':
    try:
        data=json.load(sys.stdin); result=evaluate(data)
        print(json.dumps(result,allow_nan=False,separators=(',',':')))
    except Exception:
        print('SENATE864_WEBSITE_EXPERIMENT_SAFE_FAILURE',file=sys.stderr)
        sys.exit(1)
