'use strict';
(() => {
  const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href='library-extras.css';document.head.append(stylesheet);
  const folderStyle=document.createElement('link');folderStyle.rel='stylesheet';folderStyle.href='folders.css';document.head.append(folderStyle);
  const db=window.ReaderData;
  let groups=[],assignments=[],captured=null,editing=null;
  const el=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
  const command=(icon,label,action)=>{const node=el('button');node.type='button';node.title=label;node.setAttribute('aria-label',label);node.innerHTML='<i data-lucide="'+icon+'"></i>';node.onclick=()=>Promise.resolve().then(action).catch(error=>status(error.message));return node;};
  const filter=el('select');filter.setAttribute('aria-label','書籍分類');
  const library=$('library'),content=el('div'),sidebar=el('nav'),folderList=el('div');
  content.className='library-content';content.append(...library.childNodes);sidebar.className='folder-sidebar';sidebar.setAttribute('aria-label','書櫃資料夾');library.append(sidebar,content);
  const heading=el('div');heading.className='folder-heading';heading.append(el('strong','資料夾'),command('folder-plus','管理分類',()=>{renderGroups();categories.showModal();}));sidebar.append(heading,folderList);
  let draggedBook=null;
  function renderFolders(){
    folderList.replaceChildren();
    for(const [id,name] of [['@recent','最近閱讀'],['*','全部書籍'],['','未分類'],...groups.map(g=>[g.id,g.name])]){
      const button=command(id==='@recent'?'history':id==='*'?'library':'folder',name,()=>{filter.value=id;drawShelf();});button.className='folder-item';button.dataset.folder=id;
      button.setAttribute('aria-current',String(filter.value===id));button.append(el('span',name),el('small',String(records.filter(r=>matchesFolder(r,id)).length)));
      if(id!=='*'&&id!=='@recent'){
        button.ondragover=event=>{if(!draggedBook)return;event.preventDefault();event.dataTransfer.dropEffect='move';button.classList.add('drop-target');};
        button.ondragleave=()=>button.classList.remove('drop-target');
        button.ondrop=async event=>{event.preventDefault();button.classList.remove('drop-target');const bookId=draggedBook;draggedBook=null;if(!bookId||!records.some(r=>r.id===bookId))return;try{await saveAssignment(bookId,id);status('已移至「'+name+'」');}catch(error){status('移動失敗：'+error.message);}};
      }folderList.append(button);
    }
    const recent=filter.value==='@recent';
    $('sort').disabled=recent;
    if(recent)$('sort').value='recent';
    const title=document.querySelector('.library-head h1');
    const text=Array.from(title.childNodes).find(node=>node.nodeType===Node.TEXT_NODE);
    if(text)text.textContent=(recent?'最近閱讀':filter.value==='*'?'我的書庫':groups.find(g=>g.id===filter.value)?.name||'未分類')+' ';
    if(!$('search').value.trim())$('empty').textContent=recent?'尚無閱讀紀錄，請從「全部書籍」選擇一本書開始閱讀。':'此資料夾尚無書籍';
    else $('empty').textContent='沒有符合搜尋條件的書籍';
    icons();
  }
  function options(select,value,all=false){
    select.replaceChildren();
    for(const [id,name] of [...(all?[['@recent','最近閱讀'],['*','全部分類']]:[]),['','未分類'],...groups.map(g=>[g.id,g.name])]){
      const option=el('option',name);option.value=id;select.append(option);
    }
    select.value=value;
  }
  function category(id){return assignments.find(a=>a.id===id)?.category||'';}
  function matchesFolder(record,value){return value==='@recent'?Number(record.opened)>0:value==='*'||category(record.id)===value;}
  async function saveAssignment(id,value){
    const row={id,category:value};await db.put('organization',row);
    assignments=assignments.filter(a=>a.id!==id);assignments.push(row);drawShelf();
  }
  window.LibraryExtras={
    refresh:renderFolders,
    draggable:(entry,id)=>{
      entry.draggable=true;entry.ondragstart=event=>{draggedBook=id;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',id);entry.classList.add('dragging');};
      entry.ondragend=()=>{draggedBook=null;entry.classList.remove('dragging');sidebar.querySelectorAll('.drop-target').forEach(node=>node.classList.remove('drop-target'));};
    },
    isRecent:()=>filter.value==='@recent',
    matches:id=>{const record=records.find(r=>r.id===id);return !!record&&matchesFolder(record,filter.value);},
    assignment:id=>{
      return command('folder-input','移至資料夾',()=>{
        moveList.replaceChildren();
        for(const [value,name] of [['','未分類'],...groups.map(g=>[g.id,g.name])]){
          const button=command('folder',name,async()=>{await saveAssignment(id,value);move.close();});button.className='folder-item';button.append(el('span',name));moveList.append(button);
        }move.showModal();icons();
      });
    }
  };
  options(filter,'@recent',true);filter.onchange=drawShelf;
  filter.hidden=true;document.querySelector('.filters').append(filter);
  function modal(title){
    const dialog=el('dialog');dialog.className='library-dialog';const header=el('div');header.className='dialog-heading';header.append(el('h2',title),command('x','關閉',()=>dialog.close()));dialog.append(header);document.body.append(dialog);return dialog;
  }
  const categories=modal('管理分類'),groupForm=el('form'),groupName=el('input'),groupList=el('div');
  groupName.placeholder='分類名稱';groupName.setAttribute('aria-label','分類名稱');groupName.maxLength=60;groupName.required=true;
  const add=el('button','新增分類');add.type='submit';groupForm.append(groupName,add);categories.append(groupForm,groupList);
  async function persistGroups(){await db.put('organization',{id:'categories',groups});const value=filter.value;options(filter,groups.some(g=>g.id===value)||value==='*'||value==='@recent'?value:'',true);renderGroups();drawShelf();}
  groupForm.onsubmit=async event=>{
    event.preventDefault();const name=groupName.value.trim();if(!name)return;
    if(groups.some(g=>g.name===name)){status('已有同名分類');return;}
    const previous=groups;groups=[...groups,{id:crypto.randomUUID(),name}];
    try{await persistGroups();groupName.value='';}catch(error){groups=previous;status(error.message);}
  };
  function renderGroups(){
    groupList.replaceChildren();
    for(const group of groups){
      const row=el('div');row.className='category-row';const name=el('input');name.value=group.name;name.maxLength=60;name.setAttribute('aria-label','分類名稱');
      row.append(name,command('save','儲存名稱',async()=>{
        const value=name.value.trim();if(!value||groups.some(g=>g.id!==group.id&&g.name===value))throw new Error('請填入不重複的分類名稱');
        const previous=group.name;group.name=value;try{await persistGroups();}catch(error){group.name=previous;throw error;}
      }),command('trash-2','刪除分類',async()=>{
        if(!confirm('刪除「'+group.name+'」分類？書籍將保留並改為未分類。'))return;
        for(const assignment of assignments.filter(a=>a.category===group.id))await saveAssignment(assignment.id,'');
        const previous=groups;groups=groups.filter(g=>g.id!==group.id);try{await persistGroups();}catch(error){groups=previous;throw error;}
      }));groupList.append(row);
    }icons();
  }
  const notes=modal('閱讀筆記'),context=el('p'),quote=el('blockquote'),form=el('form'),body=el('textarea'),list=el('div');
  const move=modal('移至資料夾'),moveList=el('div');move.append(moveList);
  body.rows=5;body.maxLength=20000;body.placeholder='寫下筆記';body.setAttribute('aria-label','筆記內容');
  const save=el('button','儲存筆記');save.type='submit';const reset=el('button','新增筆記');reset.type='button';reset.onclick=()=>{editing=null;body.value='';capture();showContext();};
  form.append(body,save,reset);notes.append(context,quote,form,list);
  function capture(){
    if(!active)return;
    let selected='';
    if(webReader)selected=String(webReader.root.getSelection?.()||document.getSelection()||'');
    else for(const content of rendition?.getContents()||[])selected+=String(content.window.getSelection()||'');
    captured={bookId:active.id,mode:currentMode,chapter:$('chapter').textContent,quote:selected.trim().slice(0,20000),locator:webReader?{index:webReader.index,fraction:webReader.fraction()}:{cfi:rendition?.currentLocation()?.start?.cfi}};
  }
  function showContext(){context.textContent=captured?.chapter||'目前閱讀位置';quote.textContent=captured?.quote||'';quote.hidden=!captured?.quote;}
  const noteButton=command('notebook-pen','閱讀筆記',async()=>{
    if(busy||!active)return;if(!captured||captured.bookId!==active.id)capture();editing=null;body.value='';showContext();await renderNotes();notes.showModal();body.focus();
  });
  noteButton.addEventListener('pointerdown',()=>{capture();});
  noteButton.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' ')capture();});
  document.querySelector('.reader-tools').append(noteButton);
  form.onsubmit=async event=>{
    event.preventDefault();if(!captured)return;const text=body.value.trim();if(!text&&!captured.quote){body.focus();return;}
    save.disabled=true;
    try{await db.put('annotations',{...captured,id:editing||crypto.randomUUID(),text,updated:Date.now()});editing=null;body.value='';await renderNotes();status('筆記已儲存');}
    catch(error){status('筆記儲存失敗：'+error.message);}finally{save.disabled=false;}
  };
  async function renderNotes(){
    const rows=(await db.all('annotations')).filter(n=>n.bookId===active.id&&n.kind!=='highlight').sort((a,b)=>b.updated-a.updated);list.replaceChildren();
    if(!rows.length)list.append(el('p','尚無筆記'));
    for(const note of rows){
      const row=el('article');row.className='saved-note';row.append(el('h3',note.chapter||'閱讀位置'),el('time',new Date(note.updated).toLocaleString('zh-TW')));
      if(note.quote)row.append(el('blockquote',note.quote));row.append(el('p',note.text));
      row.append(command('map-pin','回到閱讀位置',async()=>{
        notes.close();if(currentMode!==note.mode)await openBook(note.bookId,note.mode);
        if(webReader)await webReader.show(note.locator.index,note.locator.fraction);else if(note.locator.cfi)await rendition.display(note.locator.cfi);
      }),command('pencil','編輯筆記',()=>{editing=note.id;captured={...note};body.value=note.text;showContext();body.focus();}),command('trash-2','刪除筆記',async()=>{
        if(!confirm('刪除此筆記？'))return;await db.remove('annotations',note.id);if(editing===note.id){editing=null;body.value='';capture();showContext();}await renderNotes();
      }));list.append(row);
    }icons();
  }
  db.all('organization').then(rows=>{groups=rows.find(r=>r.id==='categories')?.groups||[];assignments=rows.filter(r=>r.id!=='categories');options(filter,filter.value||'@recent',true);drawShelf();icons();}).catch(error=>status('分類載入失敗：'+error.message));
})();
