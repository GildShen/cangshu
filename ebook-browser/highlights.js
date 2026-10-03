'use strict';
(() => {
  const colors=['#fff176','#ffcc80','#ef9a9a','#f48fb1','#ce93d8','#90caf9','#80cbc4','#a5d6a7'];
  const names=['黃色','橙色','紅色','粉紅','紫色','藍色','青色','綠色'];
  let chosen=colors[0],pending=null,editing=null;
  try{const saved=localStorage.getItem('reader-highlight-color');if(/^#[\da-f]{6}$/i.test(saved))chosen=saved;}catch{}
  const contexts=new WeakMap();
  let popup=null,saving=false;
  function dismiss(){popup?.remove();popup=null;}
  document.addEventListener('pointerdown',event=>{if(popup&&!event.composedPath().includes(popup))dismiss();},true);
  document.addEventListener('keydown',event=>{if(popup&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();dismiss();}},true);
  window.addEventListener('resize',dismiss);
  document.addEventListener('scroll',dismiss,true);
  const button=(icon,label,action)=>{const b=document.createElement('button');b.type='button';b.title=label;b.setAttribute('aria-label',label);b.innerHTML='<i data-lucide="'+icon+'"></i>';b.onclick=()=>Promise.resolve(action()).catch(e=>status(e.message));return b;};
  const dialog=document.createElement('dialog');dialog.className='library-dialog';dialog.setAttribute('aria-label','螢光筆顏色');
  dialog.innerHTML='<div class="dialog-heading"><h2>螢光筆</h2></div><div class="highlight-colors" role="group" aria-label="預設顏色"></div><label>自訂顏色 <input type="color" aria-label="自訂螢光筆顏色"></label><blockquote></blockquote><div class="highlight-actions"></div><div class="highlight-list"></div>';
  dialog.querySelector('.dialog-heading').append(button('x','關閉',()=>dialog.close()));document.body.append(dialog);
  const palette=dialog.querySelector('.highlight-colors'),custom=dialog.querySelector('input'),preview=dialog.querySelector('blockquote'),list=dialog.querySelector('.highlight-list');
  custom.style.cssText='width:64px;height:40px;padding:4px;vertical-align:middle;margin-left:8px;cursor:pointer';
  dialog.querySelector('.highlight-actions').style.cssText='display:flex;flex-wrap:wrap;gap:12px;margin-top:16px';
  palette.style.cssText='display:flex;flex-wrap:wrap;gap:12px;margin:16px 0';
  function select(color){chosen=color;custom.value=color;preview.style.backgroundColor=color;preview.style.color='#202020';palette.querySelectorAll('button').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.color===color));b.style.outline=b.dataset.color===color?'2px solid var(--ink)':'none';if(b.firstElementChild)b.firstElementChild.style.visibility=b.dataset.color===color?'visible':'hidden';});}
  colors.forEach((color,i)=>{const b=button('check',names[i],()=>select(color));b.dataset.color=color;b.style.cssText='background:'+color+';color:#222;width:38px;height:38px;border:2px solid transparent;outline-offset:3px';palette.append(b);});
  custom.oninput=()=>select(custom.value);
  function nodes(root){const walker=root.ownerDocument.createTreeWalker(root,4);const result=[];while(walker.nextNode()){if(!walker.currentNode.parentElement.closest('script,style'))result.push(walker.currentNode);}return result;}
  function rangeFor(root,start,end){let offset=0;const range=root.ownerDocument.createRange();let found=false;for(const node of nodes(root)){const next=offset+node.length;if(!found&&start<next){range.setStart(node,Math.max(0,start-offset));found=true;}if(found&&end<=next){range.setEnd(node,end-offset);return range;}offset=next;}return null;}
  function capture(root,section,mode){
    pending=null;editing=null;
    const selection=root.getRootNode().getSelection?.()||root.ownerDocument.getSelection();if(!selection?.rangeCount||selection.isCollapsed)return;
    const range=selection.getRangeAt(0);if(!root.contains(range.startContainer)||!root.contains(range.endContainer))return;
    let offset=0,start,end;for(const node of nodes(root)){if(node===range.startContainer)start=offset+range.startOffset;if(node===range.endContainer)end=offset+range.endOffset;offset+=node.length;}
    if(start===undefined||end===undefined||end<=start)return;
    pending={bookId:active.id,kind:'highlight',mode,section,start,end,quote:range.toString(),chapter:$('chapter').textContent};editing=null;
  }
  function contextMenu(event,root){
    dismiss();const c=contexts.get(root);capture(root,c.section,c.mode);
    if(!pending||busy)return;
    event.preventDefault();event.stopPropagation();
    const menu=document.createElement('div');popup=menu;menu.setAttribute('role','menu');menu.setAttribute('aria-label','文字標註');
    menu.style.cssText='position:fixed;z-index:10000;width:260px;max-width:calc(100vw - 16px);padding:10px;border:1px solid var(--line);border-radius:6px;background:var(--paper);color:var(--ink);box-shadow:0 8px 24px #0003';
    const quick=button('highlighter','螢光筆',()=>saveHighlight());quick.append(document.createTextNode('螢光筆'));quick.setAttribute('role','menuitem');quick.style.cssText='width:100%;justify-content:flex-start;gap:8px';menu.append(quick);
    const swatches=document.createElement('div');swatches.style.cssText='display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:8px 0';
    colors.forEach((color,i)=>{const b=button('highlighter',names[i]+'螢光筆',()=>{select(color);return saveHighlight();});b.setAttribute('role','menuitem');b.style.cssText='background:'+color+';color:#222;min-width:0;height:36px';swatches.append(b);});menu.append(swatches);
    const customButton=button('palette','自訂顏色',()=>{dismiss();return open();});customButton.append(document.createTextNode('自訂顏色…'));customButton.setAttribute('role','menuitem');customButton.style.cssText='width:100%;justify-content:flex-start;gap:8px';menu.append(customButton);
    if(window.ReaderAI){
      const selection={bookId:active.id,title:active.title,mode:currentMode,chapter:$('chapter').textContent,quote:pending.quote,locator:webReader?{index:webReader.index,fraction:webReader.fraction()}:{cfi:rendition?.currentLocation()?.start?.cfi}};
      for(const [action,label,icon] of [['translate','AI 翻譯','languages'],['explain','AI 解釋','message-circle'],['summarize','AI 摘要','list']]){const b=button(icon,label,()=>{dismiss();ReaderAI.start(action,selection);});b.append(document.createTextNode(label));b.setAttribute('role','menuitem');b.style.cssText='width:100%;justify-content:flex-start;gap:8px';menu.append(b);}
    }
    menu.addEventListener('keydown',e=>{const items=Array.from(menu.querySelectorAll('button'));const index=items.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();items[e.key==='Home'?0:e.key==='End'?items.length-1:(index+(e.key==='ArrowDown'?1:-1)+items.length)%items.length].focus();}if(e.key==='Tab')dismiss();});
    document.body.append(menu);const frame=root.ownerDocument.defaultView.frameElement;const box=frame?.getBoundingClientRect();let x=event.clientX+(box?.left||0),y=event.clientY+(box?.top||0);
    if(!event.clientX&&!event.clientY){const rect=root.getBoundingClientRect();x=rect.left+(box?.left||0)+16;y=rect.top+(box?.top||0)+32;}
    menu.style.left=Math.max(8,Math.min(x,innerWidth-menu.offsetWidth-8))+'px';menu.style.top=Math.max(8,Math.min(y,innerHeight-menu.offsetHeight-8))+'px';icons();quick.focus();
  }
  async function paint(root,section,mode,bookId){
    const rows=(await ReaderData.all('annotations')).filter(n=>n.kind==='highlight'&&n.bookId===bookId&&n.mode===mode&&n.section===section);
    const win=root.ownerDocument.defaultView;if(!win.CSS?.highlights||!win.Highlight)return;
    const context=contexts.get(root);if(!context||context.bookId!==bookId||context.section!==section)return;
    for(const key of context.keys)win.CSS.highlights.delete(key);context.keys=[];
    context.style?.remove();const style=root.ownerDocument.createElement('style');
    for(const row of rows){const range=rangeFor(root,row.start,row.end);if(!range||range.toString()!==row.quote||!/^#[\da-f]{6}$/i.test(row.color))continue;const key='hl'+row.id.replace(/[^a-z0-9]/gi,'');win.CSS.highlights.set(key,new win.Highlight(range));context.keys.push(key);style.textContent+='::highlight('+key+'){background-color:'+row.color+';color:#202020;}';}
    (root.getRootNode().host?root.getRootNode():root.ownerDocument.head).append(style);context.style=style;
  }
  function refresh(){if(webReader)return paint(webReader.article,webReader.index,currentMode,active.id);return Promise.all((rendition?.getContents()||[]).map(c=>paint(c.document.body,c.sectionIndex,'epub',active.id)));}
  window.ReaderHighlights={attach(root,section,mode){dismiss();const prior=contexts.get(root);if(!prior){root.addEventListener('contextmenu',event=>contextMenu(event,root));root.ownerDocument.addEventListener('pointerdown',event=>{if(root.ownerDocument!==document)dismiss();},true);root.ownerDocument.addEventListener('scroll',dismiss,true);root.addEventListener('mouseup',event=>{if(event.button!==0)return;const c=contexts.get(root);capture(root,c.section,c.mode);});root.addEventListener('keyup',()=>{const c=contexts.get(root);capture(root,c.section,c.mode);});}contexts.set(root,{bookId:active.id,section,mode,keys:prior?.keys||[],style:prior?.style});paint(root,section,mode,active.id).catch(e=>status(e.message));}};
  async function saveHighlight(){
    if(saving)return;
    if(!pending||pending.bookId!==active.id){status('請先選取書中文字');return;}
    saving=true;
    try{
    await ReaderData.put('annotations',{...pending,id:editing||crypto.randomUUID(),color:chosen,updated:Date.now()});
    try{localStorage.setItem('reader-highlight-color',chosen);}catch{}
    pending=null;editing=null;await refresh();dismiss();dialog.close();
    if(webReader)(webReader.root.getSelection?.()||document.getSelection())?.removeAllRanges();else for(const c of rendition?.getContents()||[])c.window.getSelection()?.removeAllRanges();
    status('重點已儲存');
    }finally{saving=false;}
  }
  const apply=button('highlighter','套用螢光標記',saveHighlight);apply.append(document.createTextNode('套用'));dialog.querySelector('.highlight-actions').append(apply);
  async function open(){
    if(!active||busy)return;if(pending?.bookId!==active.id)pending=null;
    preview.textContent=pending?.quote||'';apply.disabled=!pending;select(chosen);list.replaceChildren();
    for(const row of (await ReaderData.all('annotations')).filter(n=>n.kind==='highlight'&&n.bookId===active.id).sort((a,b)=>b.updated-a.updated)){
      const item=document.createElement('article');item.className='saved-note';const text=document.createElement('p');text.textContent=row.quote;const color=document.createElement('span');color.style.cssText='display:inline-block;width:16px;height:16px;background:'+row.color;color.setAttribute('aria-label',row.color);
      item.append(color,text,button('palette','變更顏色',()=>{pending=row;editing=row.id;preview.textContent=row.quote;select(row.color);apply.disabled=false;dialog.scrollTop=0;}),button('trash-2','刪除標記',async()=>{await ReaderData.remove('annotations',row.id);if(editing===row.id){pending=null;editing=null;}await refresh();await open();}));list.append(item);
    }if(!dialog.open)dialog.showModal();icons();
  }
  const remember=button('save','儲存預設顏色',()=>{localStorage.setItem('reader-highlight-color',chosen);dialog.close();status('螢光筆顏色已儲存');});remember.append(document.createTextNode('儲存預設顏色'));dialog.querySelector('.highlight-actions').append(remember);
  const control=button('highlighter','螢光筆',open);document.querySelector('.reader-tools').append(control);icons();
})();
