/** Fully independent, keyless 72-original-source bytes and Wayback CDX preflight. */
import {verify72ArtifactProvenance} from './verify-senate-864-72-original-artifact-bytes.mjs';
import {assertVerified72Proof} from './check-senate-864-72-neon-import-proof.mjs';
try{
 const proof=await verify72ArtifactProvenance({
  token:process.env.GH_TOKEN,repository:process.env.GITHUB_REPOSITORY,output:false
 });
 assertVerified72Proof(proof);
 console.log('SENATE_864_72_PRESECRET_COMPLETE=72_OF_72');
}catch{
 console.error('SENATE_864_72_PRESECRET_HELD_NO_DATABASE_WRITES');
 process.exitCode=1;
}
