import assert from 'node:assert/strict'
import {createSearchQueue} from '../apps/backend/src/routing-engine/searchQueue.js'
const q=createSearchQueue(2),release=await q.acquire(),abort=new AbortController(),order=[]
const cancelled=q.acquire(abort.signal)
const next=q.acquire().then(done=>{order.push('next');return done})
await assert.rejects(q.acquire(),e=>e.code==='ROUTING_BUSY')
abort.abort();await assert.rejects(cancelled,e=>e.name==='AbortError')
const last=q.acquire().then(done=>{order.push('last');return done})
release();const releaseNext=await next;assert.deepEqual(order,['next']);releaseNext();(await last)();assert.deepEqual(order,['next','last'])
const stopped=new AbortController();stopped.abort();assert.throws(()=>q.acquire(stopped.signal),e=>e.name==='AbortError')
console.log('PASS: bounded FIFO, abort removal, slot recovery, pre-aborted rejection')
