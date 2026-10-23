"""Detect ruled three-column ballot cells; never infer ink from attendance or totals."""
import hashlib, math, pathlib, subprocess, tempfile
import cv2
import numpy as np
from PIL import Image
def digest(b):return hashlib.sha256(b).hexdigest()
def clusters(values):
 out=[]
 for x in values:
  if not out or x-out[-1][-1]>4:out.append([int(x)])
  else:out[-1].append(int(x))
 return [int(round(sum(xs)/len(xs)))for xs in out]
def mark(mask):
 count=int(cv2.countNonZero(mask));area=mask.shape[0]*mask.shape[1]
 if count<=max(5,area*.0005):return {'classification':'blank','inkPixels':count}
 if count>area*.15:return {'classification':'unknown','inkPixels':count,'reason':'dense_or_occluded_cell'}
 n,labels,stats,centres=cv2.connectedComponentsWithStats(mask,8)
 components=[s for s in stats[1:] if s[4]>=4]
 if not components:return {'classification':'unknown','inkPixels':count,'reason':'unresolved_ink'}
 lines=cv2.HoughLinesP(mask,1,np.pi/180,threshold=4,minLineLength=5,maxLineGap=3)
 positive=[];negative=[]
 for item in ([]if lines is None else np.asarray(lines).reshape(-1,4)):
  x0,y0,x1,y1=map(int,item);dx=x1-x0;dy=y1-y0
  if dx and .25<=abs(dy/dx)<=4:
   (positive if dy/dx>0 else negative).append([x0,y0,x1,y1])
 cross=any(abs((a[0]+a[2]-b[0]-b[2])/2)<12 and abs((a[1]+a[3]-b[1]-b[3])/2)<12 for a in positive for b in negative)
 return {'classification':'x'if cross else 'unknown','inkPixels':count,'positiveDiagonalSegments':positive,'negativeDiagonalSegments':negative}
def cell_text(mask):
 im=Image.fromarray(255-mask);im=Image.fromarray(cv2.copyMakeBorder(np.asarray(im),14,14,14,14,cv2.BORDER_CONSTANT,value=255));im=im.resize((im.width*2,im.height*2))
 with tempfile.TemporaryDirectory(prefix='senate864-cell-')as tmp:
  p=pathlib.Path(tmp)/'cell.png';im.save(p)
  run=subprocess.run(['tesseract',str(p),'stdout','-l','eng','--psm','7'],capture_output=True,text=True,timeout=30)
  if run.returncode:raise ValueError('Cell OCR failed')
 return run.stdout.strip()
def extract_grid_from_raster(image):
 gray=np.asarray(image.convert('L'));h,w=gray.shape
 binary=cv2.threshold(gray,180,255,cv2.THRESH_BINARY_INV)[1]
 horizontal=cv2.morphologyEx(binary,cv2.MORPH_OPEN,np.ones((1,max(40,int(w*.12))),np.uint8))
 vertical=cv2.morphologyEx(binary,cv2.MORPH_OPEN,np.ones((max(40,int(h*.04)),1),np.uint8))
 grid=cv2.bitwise_or(horizontal,vertical)
 contours,_=cv2.findContours(cv2.morphologyEx(grid,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8)),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
 tables=[]
 for contour in contours:
  x,y,tw,th=cv2.boundingRect(contour)
  if not(w*.25<tw<w*.85 and h*.08<th<h*.65):continue
  hm=horizontal[y:y+th,x:x+tw];vm=vertical[y:y+th,x:x+tw]
  ys=clusters(np.where(np.count_nonzero(hm,axis=1)>=tw*.7)[0]);xs=clusters(np.where(np.count_nonzero(vm,axis=0)>=th*.7)[0])
  if len(xs)!=4 or not 5<=len(ys)<=25:continue
  if xs[1]-xs[0]<tw*.45 or min(xs[2]-xs[1],xs[3]-xs[2])<tw*.05:continue
  clean=cv2.bitwise_and(binary,cv2.bitwise_not(cv2.dilate(grid,np.ones((2,2),np.uint8))))
  rows=[]
  for ri in range(len(ys)-1):
   cells=[]
   for ci in range(3):
    x0=x+xs[ci]+3;x1=x+xs[ci+1]-3;y0=y+ys[ri]+3;y1=y+ys[ri+1]-3
    if x1<=x0 or y1<=y0:raise ValueError('Grid cell bounds invalid')
    mask=clean[y0:y1,x0:x1].copy();png=Image.fromarray(255-mask)
    import io
    buf=io.BytesIO();png.save(buf,format='PNG')
    cell={'bbox':[x0,y0,x1,y1],'cleanedPngSha256':digest(buf.getvalue()),'inkPixels':int(cv2.countNonZero(mask))}
    if ri==0 or ci==0:cell['text']=cell_text(mask)
    else:cell.update(mark(mask))
    cells.append(cell)
   rows.append({'row':ri,'cells':cells})
  tables.append({'bbox':[x,y,x+tw,y+th],'columnEdges':[x+a for a in xs],'rowEdges':[y+a for a in ys],'rows':rows,'method':'ruled_grid_mask_180_cross_diagonals_v1','pixelSource':'unmodified_authenticated_300dpi_raster'})
 return tables
if __name__=='__main__':
 if __import__('sys').argv[1:]!=['--self-test']:raise ValueError('Import extractor or --self-test only')
 blank=np.zeros((80,100),np.uint8);assert mark(blank)['classification']=='blank'
 cross=blank.copy();cv2.line(cross,(24,20),(43,46),255,2);cv2.line(cross,(43,20),(24,46),255,2);assert mark(cross)['classification']=='x'
 single=blank.copy();cv2.line(single,(24,20),(43,46),255,2);assert mark(single)['classification']=='unknown'
 dense=np.full((80,100),255,np.uint8);assert mark(dense)['classification']=='unknown'
 print('PIXEL_MARK_SELF_TEST=4 passed; no slate/tally/attendance inference')
