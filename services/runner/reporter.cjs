const send=event=>process.stdout.write(`ARCHIFY_EVENT ${JSON.stringify(event)}\n`);
module.exports=class Reporter {
  constructor(){this.count=0;this.failed=0;this.skipped=0;}
  onStepBegin(_test,_result,step){if(step.category==='test.step')send({type:'step-start',title:step.title});}
  onStepEnd(_test,_result,step){if(step.category==='test.step')send({type:'step-end',title:step.title,status:step.error?'failed':'passed',message:step.error?.message?.slice(0,8000)});}
  onTestEnd(test,result){this.count++;if(result.status==='skipped')this.skipped++;else if(result.status!=='passed')this.failed++;}
  onError(error){this.failed++;send({type:'error',message:String(error.message).slice(0,8000)});}
  onEnd(result){send({type:'result',status:result.status==='passed' && this.count>0 && !this.failed?(this.skipped===this.count?'skipped':'passed'):'failed',message:`${this.count} tests, ${this.failed} failures, ${this.skipped} skipped`});}
};
