# Independent core audit — 2026-10-05

## Authority and scope

Audit-only: no implementation files changed during this audit. This report was explicitly authorized by the root agent. Existing tests were executed independently, and the two scripts below execute current project code in ephemeral Node processes with TypeScript transpilation in memory. All provider messages and executor outcomes in these scripts are synthetic. Live CometChat certification belongs to the root runtime smoke; this report does not claim it.

Canonical authority: `02_AGENT_COURT_LOGIC.md:58-113,229-258,301-320,373-385`. Implementation audited: `agent-court/lib/court-runtime.ts`, `lib/court-service.ts`, `lib/integration-service.ts`, API routes, and frontend decision handling.

## Findings and current boundaries

- No observed P1 backend finding after independent execution.
- Closed P2: standalone receipt lacked caseId/orderId. Backend agent repaired it; current `lib/court-runtime.ts:8,187` copies canonical run case/order. The HIGH positive probe now asserts exact fields and asserts it cannot identify ORDER-101. No receipt inputs come from browser data.
- Per-run serialization and decision tombstone: `lib/court-runtime.ts:127-141,168-173`. Eight same-ID concurrent decisions yield one execution/same receipt; conflicting second decision rejects with DECISION_ALREADY_COMMITTED. FAILED_EXECUTION replay does not retry.
- Provenance, stale and expiry gates: `lib/court-runtime.ts:145-160,176-179`; expiry is checked before and after provider readback; decision ID must follow evidence IDs; immutable sender/group/type and timestamp are verified. Synthetic negative messages produce zero executions.
- Session/restart/capacity: `lib/court-runtime.ts:70-74,83-92`; cross-session status/decision 403; unknown old process run 410; capacity rejects new run without evicting committed tombstones. `lib/court-service.ts:7-10` explicitly limits replay safety to one persistent process.
- API monetary authority: `lib/court-service.ts:40-48,59-74`. Exact body keys reject amount/policy overrides; body size >4096 rejected without reliance on content-length. Session + origin checked before provider access.
- Closed frontend P2: original `components/CourtPanel.tsx:20` discarded valid incoming decisions while another request was in flight. Actual synthetic reproduction confirmed one request instead of two. Owning frontend agent repaired it with a Promise queue and a latest-status ref in current `components/CourtPanel.tsx:21-41`; independent re-execution confirmed invalid104 then valid105 generates exactly two serialized requests and ends CLOSED. Negative terminal/replay probe confirmed first204 CLOSED suppresses queued205, duplicate204 and later206: exactly one POST. Full scripts and original/repaired outputs are below. No live browser claim is made by these mocked component probes.
- Demo identities are shared: all valid demo sessions get human_judge, so session API isolation does not constitute authenticated distinct-human identity. Product auth is excluded from canonical MVP. No production identity claim.
- Refund simulation is irreversible only within an in-memory run. Receipt acknowledgement failure can occur after simulated execution; runtime exposes FAILED_EXECUTION without receipt and never retries. No money/provider call exists.

## Existing test execution

Exact command from agent-court working directory: `npm test`.

Observed after receipt fix: Test Files 2 passed (2), Tests 98 passed (98), Duration 1.03s, exit 0. Vite emitted a future native-config-loader warning for ESM syntax in vitest.config.ts loaded as CommonJS; no test failure.

## Exact reproduction command

Run in PowerShell. Each script is extracted directly from this report and piped to Node; no temporary code files, no network calls, and no secrets are printed.

```powershell
Set-Location -LiteralPath 'C:\Users\chizh\Desktop\Agent_Court_Zero_to_Chat_package\agent-court'
$auditReport = Get-Content -Raw -LiteralPath '..\reports\INDEPENDENT_CORE_AUDIT.md'
$auditScripts = [regex]::Matches($auditReport, '(?s)```javascript\r?\n(.*?)\r?\n```')
$auditScripts[0].Groups[1].Value | node
if ($LASTEXITCODE -ne 0) { throw 'Core audit failed' }
$auditScripts[1].Groups[1].Value | node
if ($LASTEXITCODE -ne 0) { throw 'API audit failed' }
```

## Core script — 29 independent probes

```javascript
const fs=require('node:fs'); const ts=require('typescript'); const assert=require('node:assert/strict');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {CourtRuntime,DECISION_LIFETIME_MS}=require('./lib/court-runtime.ts');
function fixture(options={}){
 let clock=1900000000000,seq=100,n=0,executions=0; const messages=new Map(); const state={failExecute:false,failRead:false,failReceipt:false,afterRead:null};
 const deps={now:()=>clock,randomId:()=>'audit-'+(++n),delay:async()=>{},maxRuns:options.maxRuns??100,
 provider:{createGroup:async()=>{},verifyMembers:async()=>options.members??['human_judge','executor_agent','evidence_agent','risk_agent'],
 send:async(guid,actor,text,metadata)=>{if(state.failReceipt&&metadata.courtType==='receipt')throw Error('receipt outage');const m={id:String(++seq),sender:actor,receiver:guid,receiverType:'group',category:'message',type:'text',sentAt:Math.floor(clock/1000),data:{text,metadata}};messages.set(m.id,m);return structuredClone(m)},
 readMessage:async id=>{if(state.failRead)throw Error('read outage');const m=structuredClone(messages.get(id));if(state.afterRead){const cb=state.afterRead;state.afterRead=null;await cb()}return m}},
 execute:async()=>{executions++;if(state.failExecute)throw Error('simulation failure')}};
 const runtime=new CourtRuntime(deps); return {runtime,deps,state,messages,advance:ms=>clock+=ms,get executions(){return executions},
 decision(run,text='Approve €425',changes={}){const m={id:String(++seq),sender:'human_judge',receiver:run.courtGuid,receiverType:'group',category:'message',type:'text',sentAt:Math.floor(clock/1000),data:{text},...changes};messages.set(m.id,m);return m.id}};
}
const outcomes=[]; async function probe(name,fn){try{await fn();outcomes.push({name,status:'PASS'})}catch(error){outcomes.push({name,status:'FAIL',error:error.message})}}
(async()=>{
 await probe('LOW bypass executes once without court',async()=>{const f=fixture();const r=await f.runtime.start('ORDER-101','A');assert.equal(r.status,'CLOSED');assert.equal(r.receipt.executedAmount,80);assert.equal(f.messages.size,0);assert.equal(f.executions,1)});
 await probe('MEDIUM holds review without execution',async()=>{const f=fixture();const r=await f.runtime.start('ORDER-202','A');assert.equal(r.status,'REVIEW');assert.equal(f.executions,0)});
 await probe('HIGH valid human decision executes 425 with provenance',async()=>{const f=fixture();const r=await f.runtime.start('ORDER-303','A');const id=f.decision(r);const x=await f.runtime.decide(r.runId,id,'A');assert.equal(x.status,'CLOSED');assert.equal(x.receipt.executedAmount,425);assert.equal(x.receipt.preventedAmount,425);assert.equal(x.receipt.humanDecisionMessageId,id);assert.equal(x.receipt.caseId,'ORDER-303');assert.equal(x.receipt.orderId,'ORDER-303');assert.notEqual(x.receipt.caseId,'ORDER-101');assert.equal(f.executions,1)});
 await probe('REJECT closes receipt with zero execution',async()=>{const f=fixture();const r=await f.runtime.start('ORDER-303','A');const x=await f.runtime.decide(r.runId,f.decision(r,'Reject'),'A');assert.equal(x.receipt.decision,'REJECTED');assert.equal(x.receipt.executedAmount,0);assert.equal(f.executions,0)});
 await probe('concurrent same ID yields same receipt and one execution',async()=>{const f=fixture();const r=await f.runtime.start('ORDER-303','A');const id=f.decision(r);const xs=await Promise.all(Array.from({length:8},()=>f.runtime.decide(r.runId,id,'A')));assert.equal(new Set(xs.map(x=>x.receipt.receiptId)).size,1);assert.equal(f.executions,1)});
 await probe('concurrent conflicting decisions commit only first',async()=>{const f=fixture();const r=await f.runtime.start('ORDER-303','A');const ids=[f.decision(r),f.decision(r,'Approve €100')];const xs=await Promise.allSettled(ids.map(id=>f.runtime.decide(r.runId,id,'A')));assert.equal(xs[0].status,'fulfilled');assert.equal(xs[1].status,'rejected');assert.equal(xs[1].reason.code,'DECISION_ALREADY_COMMITTED');assert.equal(f.executions,1)});
 for(const [name,changes] of [['wrong sender',{sender:'risk_agent'}],['wrong group',{receiver:'foreign-court'}],['wrong category',{category:'action'}],['wrong receiver type',{receiverType:'user'}],['edited',{editedAt:1900000001}],['deleted',{deletedAt:1900000001}],['future',{sentAt:1900000006}],['missing timestamp',{sentAt:undefined}],['updated after send',{updatedAt:1900000001}]]) await probe(name+' cannot execute',async()=>{const f=fixture();const r=await f.runtime.start('ORDER-303','A');const x=await f.runtime.decide(r.runId,f.decision(r,'Approve €425',changes),'A');assert.equal(x.status,'WAITING_HUMAN');assert.equal(x.error,'DECISION_AUTHORITY_INVALID');assert.equal(f.executions,0)});
 for(const text of ['Approve €850','garbage','Approve -425','Approve 0','Override 850: VIP'])await probe('invalid/policy command '+text+' cannot execute',async()=>{const f=fixture();const r=await f.runtime.start('ORDER-303','A');const x=await f.runtime.decide(r.runId,f.decision(r,text),'A');assert.equal(x.status,'WAITING_HUMAN');assert.equal(f.executions,0)});
 await probe('old evidence ID masquerading as decision rejected',async()=>{const f=fixture();const r=await f.runtime.start('ORDER-303','A');const id='102';f.messages.set(id,{...f.messages.get(id),sender:'human_judge',data:{text:'Approve €425'}});const x=await f.runtime.decide(r.runId,id,'A');assert.equal(x.error,'DECISION_AUTHORITY_INVALID');assert.equal(f.executions,0)});
 await probe('expired run blocks decision without execution',async()=>{const f=fixture();const r=await f.runtime.start('ORDER-303','A');f.advance(DECISION_LIFETIME_MS+1);const x=await f.runtime.decide(r.runId,f.decision(r),'A');assert.equal(x.status,'BLOCKED');assert.equal(f.executions,0)});
 await probe('expiry during provider readback cannot execute',async()=>{const f=fixture();const r=await f.runtime.start('ORDER-303','A');f.advance(DECISION_LIFETIME_MS-1000);const id=f.decision(r);f.state.afterRead=async()=>f.advance(2000);const x=await f.runtime.decide(r.runId,id,'A');assert.equal(f.executions,0);assert.equal(x.status,'BLOCKED')});
 await probe('decision readback outage leaves zero executions',async()=>{const f=fixture();const r=await f.runtime.start('ORDER-303','A');const id=f.decision(r);f.state.failRead=true;const x=await f.runtime.decide(r.runId,id,'A');assert.equal(x.error,'DECISION_READBACK_FAILED');assert.equal(f.executions,0)});
 for(const fail of ['failExecute','failReceipt'])await probe(fail+' has no success receipt and replay never retries',async()=>{const f=fixture();const r=await f.runtime.start('ORDER-303','A');const id=f.decision(r);f.state[fail]=true;const x=await f.runtime.decide(r.runId,id,'A');assert.equal(x.status,'FAILED_EXECUTION');assert.equal(x.receipt,undefined);f.state[fail]=false;await f.runtime.decide(r.runId,id,'A');assert.equal(f.executions,1)});
 await probe('cross-session status and decision denied',async()=>{const f=fixture();const r=await f.runtime.start('ORDER-303','A');assert.throws(()=>f.runtime.status(r.runId,'B'),e=>e.code==='RUN_SESSION_MISMATCH');await assert.rejects(f.runtime.decide(r.runId,f.decision(r),'B'),e=>e.code==='RUN_SESSION_MISMATCH');assert.equal(f.executions,0)});
 await probe('restart unknown run cannot resume',async()=>{const f=fixture();const r=await f.runtime.start('ORDER-303','A');const restarted=new CourtRuntime(f.deps);assert.throws(()=>restarted.status(r.runId,'A'),e=>e.status===410);await assert.rejects(restarted.decide(r.runId,f.decision(r),'A'),e=>e.status===410);assert.equal(f.executions,0)});
 await probe('capacity never evicts terminal run replay tombstone',async()=>{const f=fixture({maxRuns:1});const r=await f.runtime.start('ORDER-303','A');const id=f.decision(r);await f.runtime.decide(r.runId,id,'A');await assert.rejects(f.runtime.start('ORDER-303','A'),e=>e.code==='RUN_CAPACITY_REACHED');await f.runtime.decide(r.runId,id,'A');assert.equal(f.executions,1)});
 console.log(JSON.stringify({kind:'SYNTHETIC_INDEPENDENT_READONLY_CORE_AUDIT',passed:outcomes.filter(x=>x.status==='PASS').length,total:outcomes.length,outcomes},null,2));process.exitCode=outcomes.some(x=>x.status==='FAIL')?1:0;
})().catch(error=>{console.error(error);process.exitCode=1});
```

## API script — 9 independent probes

```javascript
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict'),Module=require('node:module');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const load=Module._load;Module._load=function(id,parent,isMain){if(id==='server-only')return {};if(id.startsWith('@/'))id=path.join(process.cwd(),id.slice(2));return load.call(this,id,parent,isMain)};
process.env.NODE_ENV='test';delete process.env.APP_ORIGIN;let network=0;global.fetch=async()=>{network++;throw Error('network must never be reached in boundary probes')};
const {NextRequest}=require('next/server');const {attachIntegrationSession,gateResponse,SESSION_COOKIE}=require('./lib/integration-service.ts');const {POST:courtPost}=require('./app/api/court/[operation]/route.ts');const {POST:refundPost}=require('./app/api/refund/route.ts');
function cookie(){const r=attachIntegrationSession(gateResponse({}),false);return SESSION_COOKIE+'='+r.cookies.get(SESSION_COOKIE).value}
const A=cookie(),B=cookie(),origin='http://127.0.0.1:3010';function req(route,body,session=A,requestOrigin=origin){return new NextRequest(origin+route,{method:'POST',headers:{origin:requestOrigin,cookie:session,'content-type':'application/json'},body:typeof body==='string'?body:JSON.stringify(body)})}
async function court(op,body,session=A){return courtPost(req('/api/court/'+op,body,session),{params:Promise.resolve({operation:op})})}
const results=[];async function probe(name,fn){try{await fn();results.push({name,status:'PASS'})}catch(e){results.push({name,status:'FAIL',error:e.message})}}
(async()=>{let low;
await probe('owned canonical LOW API executes without external provider',async()=>{const res=await court('start',{caseId:'ORDER-101'});assert.equal(res.status,200);low=await res.json();assert.equal(low.status,'CLOSED');assert.equal(low.receipt.executedAmount,80);assert.equal(network,0)});
await probe('client amount/policy/case overrides rejected before provider',async()=>{const res=await court('start',{caseId:'ORDER-303',paidAmount:99999,requestedAmount:1,policyMaximum:99999});assert.equal(res.status,400);assert.equal(network,0)});
await probe('refund client amount override rejected before provider',async()=>{const res=await refundPost(req('/api/refund',{runId:low.runId,decisionMessageId:'104',amount:850}));assert.equal(res.status,400);assert.equal(network,0)});
await probe('cross-session status is 403',async()=>{const res=await court('status',{runId:low.runId},B);assert.equal(res.status,403);assert.deepEqual(await res.json(),{error:'RUN_SESSION_MISMATCH'})});
await probe('cross-session refund is 403 with no provider access',async()=>{const res=await refundPost(req('/api/refund',{runId:low.runId,decisionMessageId:'104'},B));assert.equal(res.status,403);assert.equal(network,0)});
await probe('unknown restart run is 410 with no provider access',async()=>{const res=await court('status',{runId:'lost-from-previous-process'});assert.equal(res.status,410);assert.equal(network,0)});
await probe('malformed body is 400 before provider access',async()=>{const res=await court('start','null');assert.equal(res.status,400);assert.equal(network,0)});
await probe('body over 4096 bytes is 413 without relying on content-length',async()=>{const res=await court('start',JSON.stringify({caseId:'ORDER-303',padding:'x'.repeat(5000)}));assert.equal(res.status,413);assert.equal(network,0)});
await probe('wrong origin is 403 before any provider access',async()=>{const res=await refundPost(req('/api/refund',{runId:low.runId,decisionMessageId:'104'},A,'https://attacker.example'));assert.equal(res.status,403);assert.equal(network,0)});
console.log(JSON.stringify({kind:'SYNTHETIC_INDEPENDENT_READONLY_API_AUDIT',passed:results.filter(x=>x.status==='PASS').length,total:results.length,networkCalls:network,results},null,2));process.exitCode=results.some(x=>x.status==='FAIL')?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
```


## Actual script 1 output

```text
{
  "kind": "SYNTHETIC_INDEPENDENT_READONLY_CORE_AUDIT",
  "passed": 29,
  "total": 29,
  "outcomes": [
    {
      "name": "LOW bypass executes once without court",
      "status": "PASS"
    },
    {
      "name": "MEDIUM holds review without execution",
      "status": "PASS"
    },
    {
      "name": "HIGH valid human decision executes 425 with provenance",
      "status": "PASS"
    },
    {
      "name": "REJECT closes receipt with zero execution",
      "status": "PASS"
    },
    {
      "name": "concurrent same ID yields same receipt and one execution",
      "status": "PASS"
    },
    {
      "name": "concurrent conflicting decisions commit only first",
      "status": "PASS"
    },
    {
      "name": "wrong sender cannot execute",
      "status": "PASS"
    },
    {
      "name": "wrong group cannot execute",
      "status": "PASS"
    },
    {
      "name": "wrong category cannot execute",
      "status": "PASS"
    },
    {
      "name": "wrong receiver type cannot execute",
      "status": "PASS"
    },
    {
      "name": "edited cannot execute",
      "status": "PASS"
    },
    {
      "name": "deleted cannot execute",
      "status": "PASS"
    },
    {
      "name": "future cannot execute",
      "status": "PASS"
    },
    {
      "name": "missing timestamp cannot execute",
      "status": "PASS"
    },
    {
      "name": "updated after send cannot execute",
      "status": "PASS"
    },
    {
      "name": "invalid/policy command Approve €850 cannot execute",
      "status": "PASS"
    },
    {
      "name": "invalid/policy command garbage cannot execute",
      "status": "PASS"
    },
    {
      "name": "invalid/policy command Approve -425 cannot execute",
      "status": "PASS"
    },
    {
      "name": "invalid/policy command Approve 0 cannot execute",
      "status": "PASS"
    },
    {
      "name": "invalid/policy command Override 850: VIP cannot execute",
      "status": "PASS"
    },
    {
      "name": "old evidence ID masquerading as decision rejected",
      "status": "PASS"
    },
    {
      "name": "expired run blocks decision without execution",
      "status": "PASS"
    },
    {
      "name": "expiry during provider readback cannot execute",
      "status": "PASS"
    },
    {
      "name": "decision readback outage leaves zero executions",
      "status": "PASS"
    },
    {
      "name": "failExecute has no success receipt and replay never retries",
      "status": "PASS"
    },
    {
      "name": "failReceipt has no success receipt and replay never retries",
      "status": "PASS"
    },
    {
      "name": "cross-session status and decision denied",
      "status": "PASS"
    },
    {
      "name": "restart unknown run cannot resume",
      "status": "PASS"
    },
    {
      "name": "capacity never evicts terminal run replay tombstone",
      "status": "PASS"
    }
  ]
}
```
Exit code: 0

## Frontend P2 execution reproduction

The earlier code-grounded candidate was independently reproduced against actual CourtPanel.tsx in an ephemeral Node process with mocked React hooks, chat event listeners, and deferred refund response. ID104 (invalid above-policy decision) is processed; ID105 (valid decision) arrives during the first request. Expected: valid second ID is processed after invalid first response. Original observed: only ID104 sent, WAITING_HUMAN remains. This is synthetic asynchronous component behavior, not live browser evidence.

Exact reproduction after extraction above: `$auditScripts[2].Groups[1].Value | node`.

```javascript
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),Module=require('node:module');let listener;const calls=[],updates=[];const waiting={runId:'ui-audit-run',status:'WAITING_HUMAN',risk:{policyMaximum:425}};
const hooks={useRef:value=>({current:value}),useState:value=>[value,()=>{}],useEffect:()=>{}};
const load=Module._load;Module._load=function(id,parent,isMain){if(id==='react')return hooks;if(id==='react/jsx-runtime')return {jsx:()=>null,jsxs:()=>null};if(id==='@cometchat/chat-sdk-javascript')return {CometChat:{}};if(id==='@cometchat/chat-uikit-react')return {useCometChatEvents:cb=>{listener=cb},usePublishEvent:()=>()=>{},CometChatMessageStatus:{success:'success'}};if(id==='@/lib/cometchat-client')return {HUMAN_UID:'human_judge',demoPost:(url,body)=>new Promise(resolve=>calls.push({url,body,resolve}))};if(id==='./ActionCard')return {euros:amount=>'EUR'+amount};if(id.startsWith('@/'))id=path.join(process.cwd(),id.slice(2));return load.call(this,id,parent,isMain)};
require.extensions['.tsx']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
const {default:Panel}=require('./components/CourtPanel.tsx');Panel({run:waiting,group:{getGuid:()=> 'ui-audit-court'},onUpdate:run=>updates.push(run)});
function message(id){return {getId:()=>id,getReceiverId:()=> 'ui-audit-court',getSender:()=>({getUid:()=> 'human_judge'}),getType:()=> 'text'}}
function tick(){return new Promise(resolve=>setImmediate(resolve))}
(async()=>{listener({type:'ui:message/sent',status:'success',message:message('104')});listener({type:'ui:message/sent',status:'success',message:message('105')});await tick();const before=calls.length;calls[0].resolve({...waiting,error:'POLICY_MAXIMUM_EXCEEDED'});await tick();if(calls[1])calls[1].resolve({...waiting,status:'CLOSED',receipt:{executedAmount:425}});await tick();console.log(JSON.stringify({kind:'SYNTHETIC_READONLY_UI_ASYNC_DECISION_AUDIT',expectedRequests:2,actualRequests:calls.length,requestsBeforeFirstCompletes:before,ids:calls.map(call=>call.body.decisionMessageId),updateStates:updates.map(run=>run.status),status:calls.length===2?'PASS':'P2_REPRODUCED_VALID_SECOND_MESSAGE_DROPPED'},null,2));process.exitCode=calls.length===2?0:1})().catch(e=>{console.error(e);process.exitCode=1});
```

Original actual output (exit 1):

```text
{
  "kind": "SYNTHETIC_READONLY_UI_ASYNC_DECISION_AUDIT",
  "expectedRequests": 2,
  "actualRequests": 1,
  "requestsBeforeFirstCompletes": 1,
  "ids": [
    "104"
  ],
  "updateStates": [
    "WAITING_HUMAN"
  ],
  "status": "P2_REPRODUCED_VALID_SECOND_MESSAGE_DROPPED"
}
```


## Actual script 2 output

```text
{
  "kind": "SYNTHETIC_INDEPENDENT_READONLY_API_AUDIT",
  "passed": 9,
  "total": 9,
  "networkCalls": 0,
  "results": [
    {
      "name": "owned canonical LOW API executes without external provider",
      "status": "PASS"
    },
    {
      "name": "client amount/policy/case overrides rejected before provider",
      "status": "PASS"
    },
    {
      "name": "refund client amount override rejected before provider",
      "status": "PASS"
    },
    {
      "name": "cross-session status is 403",
      "status": "PASS"
    },
    {
      "name": "cross-session refund is 403 with no provider access",
      "status": "PASS"
    },
    {
      "name": "unknown restart run is 410 with no provider access",
      "status": "PASS"
    },
    {
      "name": "malformed body is 400 before provider access",
      "status": "PASS"
    },
    {
      "name": "body over 4096 bytes is 413 without relying on content-length",
      "status": "PASS"
    },
    {
      "name": "wrong origin is 403 before any provider access",
      "status": "PASS"
    }
  ]
}
```
Exit code: 0

## Final independently executed repository suite

Exact command: npm test

```text

> agent-court@0.1.0 test
> vitest run

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

 RUN  v4.1.11 C:/Users/chizh/Desktop/Agent_Court_Zero_to_Chat_package/agent-court


 Test Files  3 passed (3)
      Tests  126 passed (126)
   Start at  10:10:14
   Duration  1.14s (transform 511ms, setup 0ms, import 1.23s, tests 318ms, environment 1ms)

```
Exit code: 0

## Repaired frontend positive queue probe

Source: components/CourtPanel.tsx:21-41. Actual same reproduction command on repaired code:

```text
{
  "kind": "SYNTHETIC_READONLY_UI_ASYNC_DECISION_AUDIT",
  "expectedRequests": 2,
  "actualRequests": 2,
  "requestsBeforeFirstCompletes": 1,
  "ids": [
    "104",
    "105"
  ],
  "updateStates": [
    "WAITING_HUMAN",
    "CLOSED"
  ],
  "status": "PASS"
}
```
Exit code: 0

## Repaired frontend negative terminal/replay probe

Negative expected: valid first204 returns CLOSED; queued205 must never POST; duplicate204 must not POST twice; new206 arriving after terminal must not POST. Same actual component and mocked deferred event harness. Exact command after extracting script blocks: `$auditScripts[3].Groups[1].Value | node`.

```javascript
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),Module=require('node:module');let listener;const calls=[],updates=[];const waiting={runId:'ui-audit-run',status:'WAITING_HUMAN',risk:{policyMaximum:425}};
const hooks={useRef:value=>({current:value}),useState:value=>[value,()=>{}],useEffect:()=>{}};
const load=Module._load;Module._load=function(id,parent,isMain){if(id==='react')return hooks;if(id==='react/jsx-runtime')return {jsx:()=>null,jsxs:()=>null};if(id==='@cometchat/chat-sdk-javascript')return {CometChat:{}};if(id==='@cometchat/chat-uikit-react')return {useCometChatEvents:cb=>{listener=cb},usePublishEvent:()=>()=>{},CometChatMessageStatus:{success:'success'}};if(id==='@/lib/cometchat-client')return {HUMAN_UID:'human_judge',demoPost:(url,body)=>new Promise(resolve=>calls.push({url,body,resolve}))};if(id==='./ActionCard')return {euros:amount=>'EUR'+amount};if(id.startsWith('@/'))id=path.join(process.cwd(),id.slice(2));return load.call(this,id,parent,isMain)};
require.extensions['.tsx']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
const {default:Panel}=require('./components/CourtPanel.tsx');Panel({run:waiting,group:{getGuid:()=> 'ui-audit-court'},onUpdate:run=>updates.push(run)});
function message(id){return {getId:()=>id,getReceiverId:()=> 'ui-audit-court',getSender:()=>({getUid:()=> 'human_judge'}),getType:()=> 'text'}}
function tick(){return new Promise(resolve=>setImmediate(resolve))}
(async()=>{listener({type:'ui:message/sent',status:'success',message:message('204')});listener({type:'ui:message/sent',status:'success',message:message('205')});listener({type:'message/text-received',message:message('204')});await tick();calls[0].resolve({...waiting,status:'CLOSED',receipt:{executedAmount:425}});await tick();listener({type:'message/text-received',message:message('206')});await tick();console.log(JSON.stringify({kind:'SYNTHETIC_READONLY_UI_TERMINAL_DUPLICATE_AUDIT',expectedRequests:1,actualRequests:calls.length,ids:calls.map(call=>call.body.decisionMessageId),updateStates:updates.map(run=>run.status),status:calls.length===1&&updates.at(-1)?.status==='CLOSED'?'PASS':'FAIL'},null,2));process.exitCode=calls.length===1&&updates.at(-1)?.status==='CLOSED'?0:1})().catch(e=>{console.error(e);process.exitCode=1});
```




## Actual repaired frontend negative output

```text
{
  "kind": "SYNTHETIC_READONLY_UI_TERMINAL_DUPLICATE_AUDIT",
  "expectedRequests": 1,
  "actualRequests": 1,
  "ids": [
    "204"
  ],
  "updateStates": [
    "CLOSED"
  ],
  "status": "PASS"
}
```
Exit code: 0

## Audited source SHA256 snapshot

```text
lib/court-runtime.ts 9E020548D5E34FD68EA0E57531D586668296561E3DFD8C84B574C4C29089C718
lib/court-service.ts BED92BE3E0A10A9BEE3FC4B5DD4C694ED0D7F6C3371AE0BF669A5C4DDAE39172
lib/court-protocol.ts 91B2E15B180A102AE15995F533225FE556CE3D257F745ED018636B106D0D4DE1
lib/policies.ts F96C6753F2FA51267911D1ED9D11DC58742B8E00270DC2BDD0C3AB5E8AD916D4
lib/risk-engine.ts 998E4DDDCDCE24787826C907749FBBB25F7F0BEB868D2479252B0B003832822F
components/CourtPanel.tsx 914CC63AB240586D32736BED23691E01203E48E1709E99C732B471636DDC8B53
app/api/refund/route.ts E8BF5B9429AA71EE5339BEC49BC1FEFDBA63FEDF9CC4EC3E6D3D7ED53C98B572
app/api/court/[operation]/route.ts D3E79CA4E36249D47E763A296C91C95E496005E67651B841717AF606E79EDE63
```

No remaining scoped P1/P2 findings at this snapshot. Synthetic execution evidence only; live certification and external delivery remain root-owned.

FINAL_STATUS: INDEPENDENT_CORE_AUDIT_PASS_SYNTHETIC_29_CORE_9_API_2_UI_126_SUITE

## Final scoped state delta — 2026-10-05

Scope: parent repaired the REJECT acknowledgement transient state at `agent-court/lib/court-runtime.ts:168-169`. REJECT records its decision and stays BLOCKED while publishing its acknowledgement; APPROVE stays EXECUTING before simulation. Existing positive/negative audit scripts and earlier outputs above remain historical evidence. No implementation/test files were modified by this delta audit.

Exact reproduction command after extracting script blocks as above: `$auditScripts[4].Groups[1].Value | node`. Synthetic provider and delayed acknowledgement/executor boundary; no live CometChat claim.

```javascript
const fs=require('node:fs'); const ts=require('typescript'); const assert=require('node:assert/strict');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {CourtRuntime,DECISION_LIFETIME_MS}=require('./lib/court-runtime.ts');
function fixture(options={}){
 let clock=1900000000000,seq=100,n=0,executions=0; const messages=new Map(); const state={failExecute:false,failRead:false,failReceipt:false,afterRead:null};
 const deps={now:()=>clock,randomId:()=>'audit-'+(++n),delay:async()=>{},maxRuns:options.maxRuns??100,
 provider:{createGroup:async()=>{},verifyMembers:async()=>options.members??['human_judge','executor_agent','evidence_agent','risk_agent'],
 send:async(guid,actor,text,metadata)=>{if(state.failReceipt&&metadata.courtType==='receipt')throw Error('receipt outage');const m={id:String(++seq),sender:actor,receiver:guid,receiverType:'group',category:'message',type:'text',sentAt:Math.floor(clock/1000),data:{text,metadata}};messages.set(m.id,m);return structuredClone(m)},
 readMessage:async id=>{if(state.failRead)throw Error('read outage');const m=structuredClone(messages.get(id));if(state.afterRead){const cb=state.afterRead;state.afterRead=null;await cb()}return m}},
 execute:async()=>{executions++;if(state.failExecute)throw Error('simulation failure')}};
 const runtime=new CourtRuntime(deps); return {runtime,deps,state,messages,advance:ms=>clock+=ms,get executions(){return executions},
 decision(run,text='Approve €425',changes={}){const m={id:String(++seq),sender:'human_judge',receiver:run.courtGuid,receiverType:'group',category:'message',type:'text',sentAt:Math.floor(clock/1000),data:{text},...changes};messages.set(m.id,m);return m.id}};
}
function deferred(){let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve}}
const results=[];async function probe(name,fn){try{const observed=await fn();results.push({name,status:'PASS',...observed})}catch(error){results.push({name,status:'FAIL',error:error.message})}}
(async()=>{
 await probe('REJECT acknowledgement pending remains BLOCKED with zero executor calls',async()=>{
  const f=fixture();const run=await f.runtime.start('ORDER-303','owner');const entered=deferred(),release=deferred();const send=f.deps.provider.send;
  f.deps.provider.send=async(...args)=>{if(args[3].courtType==='receipt'){entered.resolve();await release.promise}return send(...args)};
  const pending=f.runtime.decide(run.runId,f.decision(run,'REJECT'),'owner');await entered.promise;
  const status=f.runtime.status(run.runId,'owner');assert.equal(status.status,'BLOCKED');assert.equal(f.executions,0);assert.equal(status.receipt,undefined);
  release.resolve();const result=await pending;assert.equal(result.status,'CLOSED');assert.equal(result.receipt.decision,'REJECTED');assert.equal(result.receipt.executedAmount,0);assert.equal(f.executions,0);
  return {duringAcknowledgement:status.status,executorCalls:f.executions,terminal:result.status,executedAmount:result.receipt.executedAmount};
 });
 await probe('APPROVE before simulated execution remains EXECUTING then closes once',async()=>{
  const f=fixture();const run=await f.runtime.start('ORDER-303','owner');const entered=deferred(),release=deferred();const execute=f.deps.execute;
  f.deps.execute=async input=>{entered.resolve();await release.promise;return execute(input)};
  const pending=f.runtime.decide(run.runId,f.decision(run,'APPROVE 425'),'owner');await entered.promise;
  const status=f.runtime.status(run.runId,'owner');assert.equal(status.status,'EXECUTING');assert.equal(f.executions,0);assert.equal(status.receipt,undefined);
  release.resolve();const result=await pending;assert.equal(result.status,'CLOSED');assert.equal(result.receipt.executedAmount,425);assert.equal(f.executions,1);
  return {beforeSimulation:status.status,executorCalls:f.executions,terminal:result.status,executedAmount:result.receipt.executedAmount};
 });
 console.log(JSON.stringify({kind:'SYNTHETIC_FINAL_DELTA_STATE_AUDIT',passed:results.filter(x=>x.status==='PASS').length,total:results.length,results},null,2));process.exitCode=results.some(x=>x.status==='FAIL')?1:0;
})().catch(error=>{console.error(error);process.exitCode=1});
```

## Actual final scoped state delta output

```text
{
  "kind": "SYNTHETIC_FINAL_DELTA_STATE_AUDIT",
  "passed": 2,
  "total": 2,
  "results": [
    {
      "name": "REJECT acknowledgement pending remains BLOCKED with zero executor calls",
      "status": "PASS",
      "duringAcknowledgement": "BLOCKED",
      "executorCalls": 0,
      "terminal": "CLOSED",
      "executedAmount": 0
    },
    {
      "name": "APPROVE before simulated execution remains EXECUTING then closes once",
      "status": "PASS",
      "beforeSimulation": "EXECUTING",
      "executorCalls": 1,
      "terminal": "CLOSED",
      "executedAmount": 425
    }
  ]
}
```
Exit code: 0

## Final delta repository regression — 127 tests

Exact command: npm test

```text

> agent-court@0.1.0 test
> vitest run

(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

 RUN  v4.1.11 C:/Users/chizh/Desktop/Agent_Court_Zero_to_Chat_package/agent-court


 Test Files  3 passed (3)
      Tests  127 passed (127)
   Start at  10:39:00
   Duration  1.10s (transform 526ms, setup 0ms, import 1.20s, tests 294ms, environment 1ms)

```
Exit code: 0

## Final delta source SHA256 snapshot

Visual source hashes record parent-owned changes only; they are not independent rendered visual certification.

```text
lib/court-runtime.ts 0737411FB2C1F9B79E5EE77B7E6B5D58B94BAFB8479A4B2579FC7AE47699EA98
lib/court-service.ts BED92BE3E0A10A9BEE3FC4B5DD4C694ED0D7F6C3371AE0BF669A5C4DDAE39172
lib/court-protocol.ts 91B2E15B180A102AE15995F533225FE556CE3D257F745ED018636B106D0D4DE1
lib/policies.ts F96C6753F2FA51267911D1ED9D11DC58742B8E00270DC2BDD0C3AB5E8AD916D4
lib/risk-engine.ts 998E4DDDCDCE24787826C907749FBBB25F7F0BEB868D2479252B0B003832822F
components/CourtPanel.tsx 914CC63AB240586D32736BED23691E01203E48E1709E99C732B471636DDC8B53
app/api/refund/route.ts E8BF5B9429AA71EE5339BEC49BC1FEFDBA63FEDF9CC4EC3E6D3D7ED53C98B572
app/api/court/[operation]/route.ts D3E79CA4E36249D47E763A296C91C95E496005E67651B841717AF606E79EDE63
tests/court-runtime.test.ts 71D55EA5E974CB1A7A8B599671E96E1D337E7C7FAFA5022CB9EEE16805B6DD3B
components/ReceiptCard.tsx 2B88ECE19AD244A2968AE3A990CF81E96188A9C4673527674C7824F7D1BD9619
components/CounterfactualCard.tsx AB4697910C63FC7236EF12A8ED3FC9DF20FBB1F6427EE4C887D9F5073904923F
app/globals.css C930800C5F1E50A26D0C830FCA1470A9173E0F7D9BB20D8447A2AE867A84ABE1
```

Final scoped delta: no remaining P1/P2. Independent delayed acknowledgement probes 2/2 PASS and repository regression 127/127 PASS. Prior evidence above is preserved. All probes are synthetic; live browser certification remains root-owned.

FINAL_STATUS: INDEPENDENT_FINAL_DELTA_AUDIT_PASS_SYNTHETIC_127_SUITE_2_STATE_PROBES
