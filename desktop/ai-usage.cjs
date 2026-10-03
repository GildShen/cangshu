'use strict';
const {StringDecoder}=require('node:string_decoder');
const count=value=>Number.isSafeInteger(value)&&value>=0?value:null;
function normalizeUsage(value){
 if(!value||count(value.input_tokens)===null||count(value.output_tokens)===null)return null;
 return {input:value.input_tokens,output:value.output_tokens,total:count(value.total_tokens)??value.input_tokens+value.output_tokens,cached:count(value.input_tokens_details?.cached_tokens??value.cached_input_tokens),reasoning:count(value.output_tokens_details?.reasoning_tokens??value.reasoning_output_tokens)};
}
function cliUsageParser(){
 const decoder=new StringDecoder('utf8');let buffer='',usage=null;
 function line(text){try{const event=JSON.parse(text);if(event.type!=='turn.completed')return;const next=normalizeUsage(event.usage);if(!next)return;if(!usage){usage=next;return;}for(const key of ['input','output','total'])usage[key]+=next[key];for(const key of ['cached','reasoning'])usage[key]=usage[key]===null||next[key]===null?null:usage[key]+next[key];}catch{}}
 function feed(text){buffer+=text;let index;while((index=buffer.indexOf('\n'))!==-1){line(buffer.slice(0,index));buffer=buffer.slice(index+1);}}
 return {push:data=>feed(decoder.write(data)),finish:()=>{feed(decoder.end());if(buffer)line(buffer);buffer='';return usage;},get:()=>usage};
}
module.exports={normalizeUsage,cliUsageParser};
