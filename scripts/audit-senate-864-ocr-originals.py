"""Source-only SHA-pinned OCR reproduction. Requires Poppler, Tesseract eng/osd, Pillow.

Supply a local originals directory; missing PDFs are fetched from the exact LRL URL.
Outputs are diagnostic text, never database mutations or automatic vote certification.
Manual rendered-page findings must be reviewed again if raster hashes change.
"""
import argparse
import collections
import hashlib
import json
import os
import pathlib
import re
import subprocess
import tempfile
import urllib.request
from PIL import Image

INPUT = 'docs/evaluation/source-proof/senate-864-population-original-inventory-20261023-explicit-labels.json'
INPUT_SHA = '685f08e5e3645fa8262d04876102e9dbbf529dcf0e7c33c669c84d67348b71ea'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def targets(data):
    if sha(data) != INPUT_SHA:
        raise ValueError('Frozen inventory SHA drift')
    docs = [d for d in json.loads(data)['originals']
            if d['date'][:4] in ('2022', '2025') and d.get('extractionMethod') == 'ocr_tesseract']
    if collections.Counter(d['date'][:4] for d in docs) != {'2022': 136, '2025': 56}:
        raise ValueError('Fixed 192-original scope drift')
    if len({d['sourceId'] for d in docs}) != 192:
        raise ValueError('Duplicate original identity')
    for d in docs:
        if not re.fullmatch(r'https://www\.lrl\.mn\.gov/archive/minutes/senate/(2022|2025)/[^?#]+\.pdf', d['sourceUrl']):
            raise ValueError('Official original URL scope drift')
        if not all(re.fullmatch('[0-9a-f]{64}', d[k]) for k in ('sourceId', 'originalSha256', 'extractedTextSha256')):
            raise ValueError('Original identity missing')
    return docs


def run(args, timeout=120, allow_failure=False):
    p = subprocess.run(args, capture_output=True, text=True, timeout=timeout,
                       env={**os.environ, 'OMP_THREAD_LIMIT': '1'})
    if p.returncode and not allow_failure:
        raise ValueError('Source tool failed: ' + args[0])
    return p


def main():
    a = argparse.ArgumentParser(description=__doc__)
    a.add_argument('--inventory', default=INPUT)
    a.add_argument('--originals', required=True)
    a.add_argument('--output', required=True)
    args = a.parse_args()
    docs = targets(pathlib.Path(args.inventory).read_bytes())
    root = pathlib.Path(args.originals)
    root.mkdir(parents=True, exist_ok=True)
    result = {'schemaVersion': 'senate864-ocr-reproduction-v1', 'sourceOnly': True,
              'productionWrites': 0, 'inputSha256': INPUT_SHA, 'dpi': 300,
              'sameEngineDifferentSegmentation': True, 'psmModes': [3, 11],
              'toolVersions': {t: run([t, '-v' if t != 'tesseract' else '--version'], allow_failure=True).stdout.strip()
                               or run([t, '-v'], allow_failure=True).stderr.strip()
                               for t in ('pdftoppm', 'pdfinfo', 'tesseract')}, 'sources': []}
    for d in docs:
        pdf = root / (d['sourceId'] + '.pdf')
        if not pdf.exists():
            request = urllib.request.Request(d['sourceUrl'], headers={'User-Agent': 'VotePredict written-Minutes source audit'})
            with urllib.request.urlopen(request, timeout=45) as response:
                if response.status != 200 or response.url != d['sourceUrl']:
                    raise ValueError('Original redirect/status changed')
                data = response.read(16_000_001)
            if len(data) > 16_000_000 or sha(data) != d['originalSha256']:
                raise ValueError('Original byte bound/SHA drift')
            pdf.write_bytes(data)
        data = pdf.read_bytes()
        if len(data) > 16_000_000 or not data.startswith(b'%PDF-') or sha(data) != d['originalSha256']:
            raise ValueError('Original byte identity changed')
        info = run(['pdfinfo', str(pdf)], timeout=20).stdout
        n = int(re.search(r'^Pages:\s*(\d+)', info, re.M)[1])
        if not 1 <= n <= 40:
            raise ValueError('Page bound changed')
        doc = {k: d[k] for k in ('sourceId', 'sourceUrl', 'originalSha256', 'extractedTextSha256', 'date', 'committee')}
        doc['pages'] = []
        with tempfile.TemporaryDirectory(prefix='senate864-ocr-') as tmp:
            directory = pathlib.Path(tmp)
            run(['pdftoppm', '-r', '300', '-png', str(pdf), str(directory / 'page')], timeout=180)
            pages = sorted(directory.glob('page-*.png'), key=lambda p: int(p.stem.split('-')[-1]))
            if len(pages) != n or [int(p.stem.split('-')[-1]) for p in pages] != list(range(1, n + 1)):
                raise ValueError('Incomplete rendered page set')
            osds = []
            for page in pages:
                with Image.open(page) as im:
                    im.verify()
                osd = run(['tesseract', str(page), 'stdout', '--psm', '0'], timeout=45, allow_failure=True)
                rotation = re.search(r'^Rotate:\s*(\d+)', osd.stdout, re.M)
                confidence = re.search(r'^Orientation confidence:\s*([\d.]+)', osd.stdout, re.M)
                osds.append({'stdout': osd.stdout, 'stderr': osd.stderr, 'rotation': int(rotation[1]) if rotation else None,
                             'confidence': float(confidence[1]) if confidence else None})
            known = [o['rotation'] for o in osds if o['rotation'] is not None and o['confidence'] >= 4]
            dominant = collections.Counter(known).most_common(1)[0][0] if known else 0
            for i, (page, osd) in enumerate(zip(pages, osds), 1):
                rotation = osd['rotation'] if osd['rotation'] is not None else dominant
                if rotation not in (0, 90, 180, 270):
                    raise ValueError('Invalid orientation')
                upright = directory / 'upright.png'
                with Image.open(page) as im:
                    im.convert('RGB').rotate(-rotation, expand=True).save(upright)
                p = {'page': i, 'raw300dpiPageSha256': sha(page.read_bytes()), 'rotationClockwise': rotation,
                     'osd': osd, 'orientationRequiresRenderedReview': True, 'passes': {}}
                for mode in (3, 11):
                    text = run(['tesseract', str(upright), 'stdout', '-l', 'eng', '--psm', str(mode)]).stdout
                    p['passes'][str(mode)] = {'text': text, 'textSha256': sha(text.encode())}
                doc['pages'].append(p)
        result['sources'].append(doc)
        print('SOURCE_ONLY_OCR=' + str(len(result['sources'])) + '/192', flush=True)
    if sum(len(d['pages']) for d in result['sources']) != 331:
        raise ValueError('Frozen 331-page census changed')
    pathlib.Path(args.output).write_text(json.dumps(result, indent=2) + '\n')


if __name__ == '__main__':
    main()
