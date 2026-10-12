/**
 * #864 V13: no private rows, names, URLs or individual source choices.
 * The official 2024 original PDF must retain the exact immutable SHA on
 * every permitted transport/extraction attempt. Bounded retries mitigate
 * transient official source network failures; they never waive SHA checks.
 */
const EXACT_ATTEMPTS=3 as const;
export async function rehydrateShaPinned2024Original<T extends {contentSha256:string}>(
 originalPdfSha256:string,
 acquire:()=>Promise<T>,
 delay:(milliseconds:number)=>Promise<void>=
   ms=>new Promise(resolve=>setTimeout(resolve,ms)),
):Promise<{value:T;attempts:number}>{
 if(!/^[a-f0-9]{64}$/.test(originalPdfSha256))
  throw Error('Immutable government PDF raw checksum not valid');
 for(let attempt=1;attempt<=EXACT_ATTEMPTS;attempt++){
  try{
   const received=await acquire();
   if(!received||received.contentSha256!==originalPdfSha256)
    throw Error('Original government PDF SHA mismatch');
   return {value:received,attempts:attempt};
  }catch{
   // Public source/PDF/parser error text can include source URLs or names.
   // Never include the caught error in a log, return value, issue receipt,
   // GitHub job output or exception to the caller.
   if(attempt===EXACT_ATTEMPTS)break;
   await delay(250*attempt);
  }
 }
 throw Error('Original 2024 PDF unavailable after bounded SHA-verified retries');
}
