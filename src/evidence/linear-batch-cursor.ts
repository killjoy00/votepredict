export interface LinearBatchPlan {
  offset:number;
  end:number;
  batchLength:number;
  nextOffset:number;
  completesPass:boolean;
}

export function planLinearBatch(input:{
  total:number;
  priorOffset:number|undefined|null;
  batchSize:number;
}):LinearBatchPlan{
  const total=Math.max(0,Math.trunc(input.total));
  const batchSize=Math.max(1,Math.trunc(input.batchSize));
  if(total===0)return {offset:0,end:0,batchLength:0,nextOffset:0,completesPass:true};
  const prior=Number.isInteger(input.priorOffset)?Number(input.priorOffset):0;
  const offset=prior>=0&&prior<total?prior:0;
  const end=Math.min(total,offset+batchSize);
  const batchLength=end-offset;
  const completesPass=end>=total;
  return {
    offset,
    end,
    batchLength,
    nextOffset:completesPass?0:end,
    completesPass,
  };
}
