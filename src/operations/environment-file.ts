import {processEnv} from '@next/env';

/** Use the application's dotenv expansion rules without retaining unrelated Vercel runtime flags. */
export function parseRuntimeEnvironment(contents:string):Record<string,string|undefined>{
 const previous={...process.env};
 try{
  const [,parsed]=processEnv([{path:'production.env',contents,env:{}}],process.cwd(),{info(){},error(){throw new Error('Could not parse production environment');}},true);
  return parsed??{};
 }finally{process.env=previous;}
}
