'use strict';
const {normalizeUsage}=require('./ai-usage.cjs');
async function callOpenAI({key,model,instructions,text,signal,fetchImpl=fetch}){
 const response=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',redirect:'error',signal,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model,instructions,input:JSON.stringify({source:text}),store:false,max_output_tokens:8192})});
 if(!response.ok){const messages={400:'請確認模型支援 Responses API 與目前參數',401:'API 金鑰無效或已過期',403:'API 金鑰沒有使用權限',404:'找不到模型，請檢查模型名稱及存取權限',429:'API 額度不足或請求過於頻繁，請檢查帳戶用量'};await response.body?.cancel().catch(()=>{});throw Error('OpenAI API（'+response.status+'）：'+(messages[response.status]||'服務暫時無法使用，請稍後重試'));}
 const data=await response.json();const usage=normalizeUsage(data.usage);
 const parts=(data.output||[]).filter(item=>item.type==='message').flatMap(item=>item.content||[]);const answer=parts.filter(item=>item.type==='output_text'&&typeof item.text==='string').map(item=>item.text).join('\n').trim();
 if(data.status!=='completed'||!answer){const error=Error(data.status==='incomplete'?'回覆未完成，可能已達輸出上限；請縮短選取文字後重試':parts.some(p=>p.type==='refusal')?'模型未提供此內容的回覆':'API 未傳回完整文字');error.usage=usage;throw error;}
 return {text:answer,model:data.model||model,provider:'openai-api',usage};
}
module.exports={callOpenAI};
