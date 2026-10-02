export interface LinearBatchPlan {
  offset:number;
  end:number;
  batchLength:number;
  nextOffset:number;
  completesPass:boolean;
}

export interface LinearBatchProgress {
  nextOffset:number;
  complete:boolean;
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
  const offset=prior>=0&&prior<=total?prior:0;
  if(offset===total){
    return {offset:total,end:total,batchLength:0,nextOffset:total,completesPass:true};
  }
  const end=Math.min(total,offset+batchSize);
  const batchLength=end-offset;
  const completesPass=end>=total;
  return {
    offset,
    end,
    batchLength,
    nextOffset:end,
    completesPass,
  };
}

export function finalizeLinearBatch(
  plan:LinearBatchPlan,
  retryRequired:boolean,
):LinearBatchProgress{
  if(retryRequired){
    return {nextOffset:plan.offset,complete:false};
  }
  return {nextOffset:plan.nextOffset,complete:plan.completesPass};
}
