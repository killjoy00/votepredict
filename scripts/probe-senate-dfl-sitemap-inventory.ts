/** Public, keyless preflight of original 2026-pinned DFL post sitemaps. */
import {
  HISTORICAL_DFL_SITEMAPS,fetchArchivedDFLSitemap,
  orderedHistoricalDFLCandidates,historicalDFLSitemapManifest,
} from '../src/sources/minnesota/senate-dfl-sitemap-archive.js';
async function main():Promise<void>{
  const pages=[];
  for(const index of HISTORICAL_DFL_SITEMAPS){
    const result=await fetchArchivedDFLSitemap(index);
    const years:Record<string,number>={};
    for(const row of result.candidateUrls) {
      const key=row.lastModifiedOn?.slice(0,4)??'undated';
      years[key]=(years[key]??0)+1;
    }
    console.log('SENATE_DFL_PINNED_SITEMAP='+JSON.stringify({
      id:result.id,entries:result.urlEntries,excludedBefore2023:result.excludedBefore2023,
      candidates:result.candidateUrls.length,years,sha256:result.sha256,
    }));
    pages.push(result);
  }
  const originals=orderedHistoricalDFLCandidates(pages);
  if(originals.length<300||originals.length>2000)
    throw Error('Archived publisher original sitemap count outside reviewed bound');
  console.log('SENATE_DFL_PINNED_SITEMAPS='+JSON.stringify({
    totalOriginalUrls:originals.length,publisherXmlSha256:historicalDFLSitemapManifest(pages),
    sample:originals.slice(0,3).map(x=>x.url),
  }));
}
void main().catch(error=>{
  console.error('SENATE_DFL_PINNED_SITEMAPS_HELD='+(
    error instanceof Error?error.message:'unknown'));
  process.exitCode=1;
});
