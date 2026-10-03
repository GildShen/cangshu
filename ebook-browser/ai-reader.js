'use strict';
(() => {
 const api=window.desktopReader;
 const actions={translate:'翻譯',explain:'解釋',summarize:'摘要'};
 let source=null,result=null,running=false;const consented=new Set();
 const node=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
 const button=(icon,label,fn)=>{const b=node('button');b.type='button';b.title=label;b.setAttribute('aria-label',label);b.innerHTML='<i data-lucide="'+icon+'"></i>';b.onclick=()=>Promise.resolve().then(fn).catch(e=>{message.textContent=e.message;});return b;};
 const style=node('link');style.rel='stylesheet';style.href='ai-reader.css';document.head.append(style);
 const panel=node('section');panel.id='ai-panel';panel.hidden=true;panel.setAttribute('aria-label','AI 閱讀助理');
 const header=node('div');header.className='ai-heading';header.append(node('h2','AI 閱讀助理'),button('settings','AI 設定',configure),button('x','關閉 AI 側欄',()=>{panel.hidden=true;}));
 const location=node('p'),quote=node('blockquote'),message=node('p'),answer=node('div');message.setAttribute('role','status');answer.className='ai-answer';answer.setAttribute('aria-live','polite');
 const usage=node('p');usage.className='ai-usage';usage.setAttribute('aria-label','Token 用量');
 function showUsage(value){usage.replaceChildren();if(!value){usage.textContent='Token 用量：未回報（不代表零消耗）';return;}usage.append(node('span','Token · 輸入 '+value.input.toLocaleString()+' · 輸出 '+value.output.toLocaleString()+' · 合計 '+value.total.toLocaleString()));const details=[];if(value.cached!==null)details.push('輸入含快取 '+value.cached.toLocaleString());if(value.reasoning!==null)details.push('輸出含推理 '+value.reasoning.toLocaleString());if(details.length)usage.append(node('br'),node('small',details.join(' · ')));}
 const commands=node('div');commands.className='ai-actions';
 for(const [action,label] of Object.entries(actions)){const b=button(action==='translate'?'languages':action==='explain'?'message-circle':'list',label,()=>run(action));b.append(node('span',label));commands.append(b);}
 const cancel=button('square','取消 AI 工作',async()=>{cancel.disabled=true;message.textContent='正在取消…';await api.aiCancel();});cancel.hidden=true;
 const retry=button('rotate-ccw','重試',()=>run(source?.action));retry.disabled=true;
 const copy=button('copy','複製結果',async()=>{await api.aiCopy(result.text);message.textContent='已複製';});copy.disabled=true;
 const save=button('notebook-pen','存成筆記',async()=>{
  if(!result)return;if(!await store.get(result.source.bookId))throw Error('原書已移除，無法儲存筆記');
  save.disabled=true;
  try{const s=result.source;await ReaderData.put('annotations',{id:crypto.randomUUID(),bookId:s.bookId,mode:s.mode,chapter:s.chapter,quote:s.quote,locator:s.locator,text:'AI '+actions[s.action]+'\n\n'+result.text,updated:Date.now(),ai:{provider:result.provider,model:result.model,usage:result.usage}});message.textContent='已存入《'+s.title+'》的筆記';}catch(e){save.disabled=false;throw e;}
 });save.append(node('span','存成筆記'));save.disabled=true;
 const footer=node('div');footer.className='ai-actions';footer.append(cancel,retry,copy,save);
 panel.append(header,location,quote,commands,message,usage,answer,footer);document.querySelector('.reading-body').append(panel);
 document.querySelector('.reader-tools').append(button('sparkles','AI 閱讀助理',()=>{panel.hidden=!panel.hidden;if(!api)message.textContent='AI 整合僅限桌面版';}));
 const settingsDialog=node('dialog');settingsDialog.className='library-dialog';settingsDialog.setAttribute('aria-label','AI 設定');
 const settingsHeading=node('div');settingsHeading.className='dialog-heading';settingsHeading.append(node('h2','AI 引擎'),button('x','關閉 AI 設定',()=>settingsDialog.close()));
 const state=node('p'),pathLabel=node('p'),label=node('label','模型（留空使用 CLI 預設）'),model=node('input');model.type='text';model.maxLength=100;model.setAttribute('aria-label','Codex 模型');label.append(model);
 const engineLabel=node('label','AI 引擎'),engine=node('select');engine.setAttribute('aria-label','AI 引擎');for(const [value,text] of [['codex-cli','Codex CLI'],['openai-api','OpenAI API']]){const option=node('option',text);option.value=value;engine.append(option);}engineLabel.append(engine);
 const apiModelLabel=node('label','API 模型'),apiModel=node('input');apiModel.maxLength=100;apiModel.setAttribute('aria-label','API 模型');apiModelLabel.append(apiModel);
 const keyLabel=node('label','OpenAI API 金鑰'),key=node('input');key.type='password';key.autocomplete='new-password';key.spellcheck=false;key.maxLength=1024;key.setAttribute('aria-label','OpenAI API 金鑰');keyLabel.append(key);
 const choose=button('folder-open','選擇 codex.exe',async()=>display(await api.aiChooseCli()));
 const remove=button('trash-2','移除 API 金鑰',async()=>{if(confirm('移除已儲存的 API 金鑰？'))display(await api.aiConfigure({removeKey:true}));});
 const saveSettings=button('save','儲存 AI 設定',async()=>{saveSettings.disabled=true;const change={provider:engine.value,model:model.value.trim(),apiModel:apiModel.value.trim(),apiKey:key.value};key.value='';try{display(await api.aiConfigure(change));}catch(e){state.textContent=e.message;}finally{saveSettings.disabled=false;}});
 const settingsActions=node('div');settingsActions.className='ai-actions';settingsActions.append(choose,remove,button('refresh-cw','檢查設定',async()=>display(await api.aiCheck())),saveSettings);
 settingsDialog.append(settingsHeading,engineLabel,state,pathLabel,label,apiModelLabel,keyLabel,settingsActions);document.body.append(settingsDialog);
 function fields(){const isApi=engine.value==='openai-api';label.hidden=isApi;pathLabel.hidden=isApi;choose.hidden=isApi;apiModelLabel.hidden=!isApi;keyLabel.hidden=!isApi;remove.hidden=!isApi;}
 engine.onchange=()=>{fields();state.textContent=engine.value==='openai-api'?'OpenAI API 按用量另外計費':'使用 Codex CLI 登入與額度';};
 settingsDialog.addEventListener('close',()=>{key.value='';});
 function display(data){state.textContent=data.message;pathLabel.textContent=data.cliPath||'';model.value=data.model||'';apiModel.value=data.apiModel||'gpt-4.1-mini';engine.value=data.provider||'codex-cli';key.value='';key.placeholder=data.hasApiKey?'已儲存，留空保留':'貼上 API 金鑰';remove.disabled=!data.hasApiKey;fields();}
 async function configure(){if(!api){message.textContent='AI 整合僅限桌面版';return;}settingsDialog.showModal();state.textContent='檢查中…';try{display(await api.aiCheck());}catch(e){state.textContent=e.message;}}
 function controls(){commands.querySelectorAll('button').forEach(b=>b.disabled=running||!source);retry.disabled=running||!source;cancel.hidden=!running;cancel.disabled=false;}
 async function run(action){
  if(running||!source||!Object.hasOwn(actions,action))return;
  if(!api){message.textContent='請使用桌面版執行 AI';return;}
  source={...source,action};const snapshot=structuredClone(source);running=true;controls();
  try{const info=await api.aiInfo();if(!consented.has(info.provider)){if(!confirm('將選取文字傳送至 '+(info.provider==='openai-api'?'OpenAI API（按 API 用量另外計費）':'Codex CLI（使用 Codex 帳戶額度）')+'。是否繼續？'))return;consented.add(info.provider);}
   result=null;answer.textContent='';usage.textContent='Token 用量：等待服務回報';copy.disabled=true;save.disabled=true;message.textContent='正在'+actions[action]+'…';
   const response=await api.aiRun({action,text:snapshot.quote});showUsage(response.usage);if(!response.ok)throw Error(response.error);result={...response,source:snapshot};answer.textContent=response.text;message.textContent='完成 · '+response.model;copy.disabled=false;save.disabled=false;}
  catch(e){message.textContent=e.message;if(usage.textContent==='Token 用量：等待服務回報')showUsage(null);}
  finally{running=false;controls();}
 }
 window.ReaderAI={start(action,selection){
  panel.hidden=false;if(running){message.textContent='已有 AI 工作執行中，請先取消或等待完成';return;}
  if(selection.quote.length>20000){message.textContent='一次最多處理 20,000 字，請縮小選取範圍';return;}
  source=structuredClone(selection);source.action=action;result=null;answer.textContent='';usage.textContent='';location.textContent=source.title+' · '+source.chapter;quote.textContent=source.quote;copy.disabled=true;save.disabled=true;controls();run(action);
 }};
 controls();icons();
})();
