"""SHA-pinned 55-original follow-up and three demonstrated parser misses. Source-only."""
import concurrent.futures, collections, hashlib, html, json, os, pathlib, re, subprocess, tempfile, urllib.request
from PIL import Image, ImageDraw
ROOT=pathlib.Path('artifacts/senate864-55-followup')
REG='docs/evaluation/source-proof/senate-864-population-original-registry-20261023-renewal-ocr.json'
REG_SHA='7fe7842dfcbf56d9c55200fc01034321af6a067cb921daac52aee29506e95acc'
EXTRA={'26bd713e33f085984e2607e8e60ab86251e7e3fe68da3e6b3d10d89663c7257b','b09b0b455312903eaa01defd0167b7bcf6fda405807352f2ff6739b1d59509f5','38c8be767d77dada704fac695980816414f9a5b13cc4aa9091abc9fc09a556d5'}
sha=lambda b:hashlib.sha256(b).hexdigest()
def run(args,timeout=120,allow=False):
 p=subprocess.run(args,capture_output=True,text=True,timeout=timeout,env={**os.environ,'OMP_THREAD_LIMIT':'1'})
 if p.returncode and not allow:raise ValueError('Source process failed: '+args[0])
 return p
def targets():
 data=pathlib.Path(REG).read_bytes()
 if sha(data)!=REG_SHA:raise ValueError('Frozen registry drift')
 ds=[d for d in json.loads(data) if d['sourceId'] in EXTRA or d['date'][:4] in ('2023','2024') and d.get('extractionMethod')=='ocr_tesseract']
 if len(ds)!=58 or collections.Counter(d['date'][:4] for d in ds)!={'2022':3,'2023':24,'2024':31}:raise ValueError('58-source scope drift')
 if len({d['sourceId'] for d in ds})!=58:raise ValueError('Duplicate source')
 for d in ds:
  if not re.fullmatch(r'https://www\.lrl\.mn\.gov/archive/minutes/senate/202[234]/[^?#]+\.pdf',d['sourceUrl']):raise ValueError('URL scope drift')
 return ds
def download(url,limit):
 req=urllib.request.Request(url,headers={'User-Agent':'VotePredict historical written-Minutes source audit'})
 with urllib.request.urlopen(req,timeout=45) as r:
  if r.status!=200 or r.url!=url:raise ValueError('Original redirect/status changed')
  b=r.read(limit+1)
 if len(b)>limit:raise ValueError('Original byte bound')
 return b
def one(d):
 sid=d['sourceId'];directory=ROOT/sid;directory.mkdir(parents=True,exist_ok=True)
 result={**d,'sourceOnly':True,'productionWrites':0,'pages':[]}
 with tempfile.TemporaryDirectory(prefix='senate864-55-') as tmp:
  tmp=pathlib.Path(tmp);pdf=tmp/'original.pdf';data=None
  for attempt in range(2):
   try:data=download(d['sourceUrl'],16000000);break
   except Exception:
    if attempt:raise
  if not data.startswith(b'%PDF-') or sha(data)!=d['originalSha256']:raise ValueError('Original PDF SHA drift')
  pdf.write_bytes(data);n=int(re.search(r'^Pages:\s*(\d+)',run(['pdfinfo',str(pdf)],20).stdout,re.M)[1])
  if not 1<=n<=40:raise ValueError('Page bound')
  run(['pdftoppm','-r','300','-png',str(pdf),str(tmp/'page')],180)
  pages=sorted(tmp.glob('page-*.png'),key=lambda p:int(p.stem.split('-')[-1]))
  if [int(p.stem.split('-')[-1])for p in pages]!=list(range(1,n+1)):raise ValueError('Incomplete render')
  osds=[]
  for path in pages:
   with Image.open(path) as im:im.verify()
   r=run(['tesseract',str(path),'stdout','--psm','0'],45,True);rot=re.search(r'^Rotate:\s*(\d+)',r.stdout,re.M);conf=re.search(r'^Orientation confidence:\s*([\d.]+)',r.stdout,re.M)
   osds.append({'stdout':r.stdout,'stderr':r.stderr,'rotation':int(rot[1])if rot else None,'confidence':float(conf[1])if conf else None})
  known=[o['rotation']for o in osds if o['rotation']is not None and o['confidence']>=4];dominant=collections.Counter(known).most_common(1)[0][0]if known else 0
  for i,(path,osd)in enumerate(zip(pages,osds),1):
   rotation=osd['rotation']if osd['rotation']is not None else dominant
   if rotation not in (0,90,180,270):raise ValueError('Orientation invalid')
   with Image.open(path)as im:im=im.convert('RGB').rotate(-rotation,expand=True)
   upright=tmp/'upright.png';im.save(upright)
   review=im.copy();box=review.convert('L').point(lambda v:255 if v<245 else 0).getbbox()
   if box:
    x0,y0,x1,y1=box;review=review.crop((max(0,x0-30),max(0,y0-30),min(im.width,x1+30),min(im.height,y1+30)))
   review.thumbnail((1100,1500));jpg=directory/('page-'+str(i)+'.jpg');review.save(jpg,quality=88)
   p={'page':i,'raw300dpiPageSha256':sha(path.read_bytes()),'width':im.width,'height':im.height,'rotationClockwise':rotation,'osd':osd,'blankRaster':box is None,'reviewImageSha256':sha(jpg.read_bytes()),'renderedReview':'pending','passes':{}}
   for mode in (3,11):
    prefix=tmp/('ocr-'+str(mode));run(['tesseract',str(upright),str(prefix),'-l','eng','--psm',str(mode),'txt','tsv'])
    text=prefix.with_suffix('.txt').read_text();words=[]
    for line in prefix.with_suffix('.tsv').read_text().splitlines()[1:]:
     c=line.split('\t')
     if len(c)>=12 and c[11].strip():words.append({'x':int(c[6]),'y':int(c[7]),'w':int(c[8]),'h':int(c[9]),'confidence':float(c[10]),'text':c[11]})
    p['passes'][str(mode)]={'text':text,'textSha256':sha(text.encode()),'wordBoxes':words}
   (directory/('page-'+str(i)+'.json')).write_text(json.dumps(p,indent=2)+'\n')
   result['pages'].append({k:p[k]for k in ('page','raw300dpiPageSha256','rotationClockwise','blankRaster','reviewImageSha256')})
 result['pageCount']=len(result['pages']);result['originalBytesAuthenticated']=True
 (directory/'source.json').write_text(json.dumps(result,indent=2)+'\n')
 return result
def clerk_probes():
 out=[]
 for hid in (16667,16818,16933):
  for host,path in [('www.senate.mn','hearing_minutes.html'),('goldpages.senate.mn','hearing_minutes.php')]:
   url='https://'+host+'/schedule/'+path+'?always_show_minutes=Y&hearing_id='+str(hid)+'&ls=92&type=minutes'
   item={'sourceUrl':url,'hearingId':hid,'sourceOnly':True}
   try:
    raw=download(url,2000000);text=raw.decode('utf-8');name='clerk-'+str(hid)+'-'+host.split('.')[0]+'.json'
    visible=html.unescape(re.sub('<[^>]+>',' ',re.sub(r'<(script|style)\b[^>]*>[\s\S]*?</\1>',' ',text,flags=re.I)))
    item.update({'rawSha256':sha(raw),'rawHtml':text,'diagnosticText':re.sub(r'\s+',' ',visible).strip(),'extractionIsDiagnostic':True})
   except Exception as e:item.update({'hold':type(e).__name__+': '+str(e)[:180]})
   out.append(item)
 (ROOT/'clerk-probes.json').write_text(json.dumps(out,indent=2)+'\n')
if __name__=='__main__':
 import sys
 ds=targets()
 if sys.argv[1:]==['--scope-only']:print('FIXED_PUBLIC_SOURCES=58 (55 remaining OCR + 3 parser misses)');sys.exit(0)
 if sys.argv[1:]:raise ValueError('Fixed acquisition mode only')
 ROOT.mkdir(parents=True,exist_ok=True);results=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=3)as pool:
  for result in pool.map(one,ds):results.append(result);print('SOURCE_ONLY_ORIGINALS='+str(len(results))+'/58',flush=True)
 clerk_probes();manifest={'schemaVersion':'senate864-55-followup-review-v1','reviewedCommit':os.environ.get('GITHUB_SHA'),'runId':os.environ.get('GITHUB_RUN_ID'),'sourceOnly':True,'productionWrites':0,'registrySha256':REG_SHA,'remainingOcrOriginals':55,'demonstratedParserMissOriginals':3,'originalsAuthenticated':len(results),'pages':sum(d['pageCount']for d in results),'sameEngineDifferentSegmentation':True,'dpi':300,'psmModes':[3,11],'sources':results,'renderedReview':'pending','files':[]}
 for p in sorted(ROOT.rglob('*')):
  if p.is_file():manifest['files'].append({'path':str(p.relative_to(ROOT)),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())})
 (ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
 print('SOURCE_ONLY_COMPLETE='+str(len(results))+' originals / '+str(manifest['pages'])+' pages',flush=True)
