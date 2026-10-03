'use strict';
const $ = id => document.getElementById(id);
const store = window.LibraryStore;
let records = [], active, book, rendition, busy = false, generation = 0;
let coverUrls = [], tocItems = [];
let webReader=null,currentMode='epub';
let disposePicture;
function readingKey(event){
  if(event.target?.closest?.('#ai-panel'))return;
  if(busy||$('reader').hidden||document.querySelector('dialog[open], [role="menu"][aria-label="文字標註"]'))return;
  if(webReader){webReader.handleKey(event);return;}
  if(!rendition||!WebBookReader.keyboardAllowed(event))return;
  const direction={ArrowLeft:-1,ArrowUp:-1,ArrowRight:1,ArrowDown:1,PageUp:-1,PageDown:1}[event.key];
  if(!direction)return;event.preventDefault();
  if(event.key.startsWith('Page')){
    const location=rendition.currentLocation();
    const current=location?.start&&book.spine.get(location.start.cfi);
    const section=current&&(direction>0?current.next():current.prev());
    if(section)rendition.display(section.href).catch(error=>status(error.message));
  }else(direction>0?rendition.next():rendition.prev()).catch(error=>status(error.message));
}
document.addEventListener('keydown',readingKey);
const settings = {size:22,font:'serif',spacing:'1.8',dark:false};
try {Object.assign(settings, JSON.parse(localStorage.getItem('epub-reader-settings') || '{}'));} catch {}
settings.size = Math.max(16,Math.min(36,Number(settings.size)||22));
function icons(){lucide.createIcons({attrs:{'stroke-width':1.6}});}
function status(message=''){$('status').textContent=message;}
function bounded(promise){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('載入逾時，請檢查檔案是否完整')),60000);})]).finally(()=>clearTimeout(timer));}
function saveSettings(){try{localStorage.setItem('epub-reader-settings',JSON.stringify(settings));}catch{status('無法儲存閱讀設定。');}}
function theme(){
  document.body.classList.toggle('dark',!!settings.dark);
  $('size').value=settings.size;$('size-value').textContent=settings.size;
  $('font').value=settings.font;$('spacing').value=settings.spacing;
  $('theme').setAttribute('aria-pressed',!!settings.dark);
  if(webReader){webReader.settings(settings);return;}
  if(!rendition)return;
  const ink=settings.dark?'#e7ece8':'#252e29',paper=settings.dark?'#202622':'#ffffff';
  rendition.themes.default({body:{color:ink+' !important',background:paper+' !important','line-height':settings.spacing+' !important'},'p,li,span':{'font-size':'inherit !important','line-height':'inherit !important'},img:{'max-width':'100%','object-fit':'contain'},'img[zy-footnote]':{cursor:'pointer'}});
  rendition.themes.fontSize(settings.size+'px');
  if(settings.font==='original')rendition.themes.removeOverride('font-family');
  else rendition.themes.font(WebBookReader.fontFamily(settings.font));
}
function drawShelf(){
  coverUrls.forEach(URL.revokeObjectURL);coverUrls=[];$('shelf').replaceChildren();
  const query=$('search').value.trim().toLocaleLowerCase();
  const filtered=records.filter(r=>(r.title+' '+r.author).toLocaleLowerCase().includes(query)&&(!window.LibraryExtras||LibraryExtras.matches(r.id)));
  filtered.sort((a,b)=>window.LibraryExtras?.isRecent()?b.opened-a.opened:$('sort').value==='title'?a.title.localeCompare(b.title,'zh-Hant'):$('sort').value==='added'?b.added-a.added:(b.opened||b.added)-(a.opened||a.added));
  $('total').textContent=filtered.length+' 本';$('empty').hidden=filtered.length!==0;
  for(const record of filtered){
    const entry=document.createElement('article');entry.className='entry';
    const cover=document.createElement('button');cover.className='cover-button';cover.title='閱讀 '+record.title;cover.onclick=()=>openBook(record.id);
    if(record.cover){const img=document.createElement('img');img.src=URL.createObjectURL(record.cover);coverUrls.push(img.src);img.alt=record.title+' 封面';cover.append(img);}else{const text=document.createElement('span');text.className='cover-fallback';text.textContent=record.title;cover.append(text);}
    const title=document.createElement('h2');title.textContent=record.title;
    const author=document.createElement('p');author.textContent=record.author||'作者未標示';
    const meta=document.createElement('p');meta.textContent=(record.web?'網頁版已就緒':'EPUB 原版')+' · '+record.sections+' 個閱讀段落 · '+(record.size/1048576).toFixed(1)+' MB';
    const actions=document.createElement('div');actions.className='entry-actions';
    const read=document.createElement('button');read.className='read';read.textContent=record.opened?'繼續閱讀':'開始閱讀';read.onclick=()=>openBook(record.id);
    const remove=document.createElement('button');remove.title='移除 '+record.title;remove.setAttribute('aria-label',remove.title);remove.innerHTML='<i data-lucide="trash-2"></i>';remove.onclick=async()=>{if(!confirm('從書庫移除《'+record.title+'》？原始 EPUB 檔案不受影響。'))return;try{await store.remove(record.id);await store.removePosition(record.id);records=records.filter(r=>r.id!==record.id);drawShelf();}catch(e){status('移除失敗：'+e.message);}};
    const convert=document.createElement('button');convert.title=record.web?'匯出離線網頁 ZIP':'轉成網頁版';convert.setAttribute('aria-label',convert.title);convert.innerHTML=record.web?'<i data-lucide="download"></i>':'<i data-lucide="file-code-2"></i>';convert.onclick=()=>record.web?exportBook(record.id):convertBook(record.id);
    if(record.type==='pdf'){meta.textContent='PDF · '+record.sections+' 頁 · '+(record.size/1048576).toFixed(1)+' MB';convert.hidden=true;}
    actions.append(read,convert,remove);entry.append(cover,title,author,meta,actions);if(window.LibraryExtras){actions.insertBefore(LibraryExtras.assignment(record.id),remove);LibraryExtras.draggable(entry,record.id);}$('shelf').append(entry);
  }if(window.LibraryExtras)LibraryExtras.refresh();icons();
}
async function importFiles(files){
  if(busy)return [];busy=true;$('files').disabled=true;
  const importedIds=[];
  let imported=0,duplicates=0;const errors=[];
  for(const file of files){
    let parsed;
    try{
      if(!/\.(epub|pdf)$/i.test(file.name))throw new Error('請選擇 EPUB 或 PDF 檔案');
      status('正在匯入 '+file.name);
      const data=await file.arrayBuffer();
      const hash=await crypto.subtle.digest('SHA-256',data);
      const id=Array.from(new Uint8Array(hash),n=>n.toString(16).padStart(2,'0')).join('');
      if(records.some(r=>r.id===id)){duplicates++;importedIds.push(id);continue;}
      if(/\.pdf$/i.test(file.name)){
        const metadata=await PdfReader.metadata(data);const record={id,type:'pdf',title:metadata.title||file.name.replace(/\.pdf$/i,''),author:metadata.author||'',sections:metadata.sections,data,size:file.size,added:Date.now(),opened:0};
        await store.put(record);records.push(record);imported++;importedIds.push(id);continue;
      }
      const zip=await JSZip.loadAsync(data);
      if(!zip.file('META-INF/container.xml'))throw new Error('缺少 EPUB 容器資訊');
      if(zip.file('META-INF/encryption.xml')){
        const encryption=await zip.file('META-INF/encryption.xml').async('string');
        const xml=new DOMParser().parseFromString(encryption,'application/xml');
        const methods=Array.from(xml.getElementsByTagNameNS('*','EncryptionMethod'));
        if(methods.some(m=>!['http://www.idpf.org/2008/embedding','http://ns.adobe.com/pdf/enc#RC'].includes(m.getAttribute('Algorithm'))))throw new Error('此書含 DRM 加密，無法載入');
      }
      parsed=ePub(data,{replacements:'blobUrl'});await bounded(parsed.opened);
      const metadata=await parsed.loaded.metadata;let cover=null;
      try{const url=await parsed.coverUrl();if(url)cover=await (await fetch(url)).blob();}catch{}
      const record={id,title:metadata.title||file.name,author:metadata.creator||'',data,cover,size:file.size,sections:parsed.spine.spineItems.length,added:Date.now(),opened:0};
      if(!record.sections)throw new Error('找不到可閱讀章節');
      await store.put(record);records.push(record);imported++;importedIds.push(id);
      if($('import-mode').value==='web'){
        try{record.web=await EpubConverter.convert(data,(n,total)=>status(`正在轉換 ${record.title}：${n} / ${total}`));await store.put(record);if(record.web.warnings.length)errors.push(record.title+'：'+record.web.warnings.length+' 項轉換提醒，請於網頁模式查看');}
        catch(error){delete record.web;errors.push(record.title+'：已保留 EPUB，網頁轉換失敗：'+error.message);}
      }
    }catch(e){errors.push(file.name+'：'+e.message);}finally{if(parsed)parsed.destroy();}
  }
  busy=false;$('files').disabled=false;$('files').value='';drawShelf();
  status(`已匯入 ${imported} 本`+(duplicates?`，略過 ${duplicates} 本重複書籍`:'')+(errors.length?'。'+errors.join('；'):''));
  return importedIds;
}
function tocTree(items){
  const ol=document.createElement('ol');
  for(const item of items){
    tocItems.push(item);const li=document.createElement('li'),button=document.createElement('button');button.textContent=item.label.trim()||'未命名章節';button.dataset.href=item.href;
    button.onclick=()=>{if(webReader){const q=new URLSearchParams(item.href.slice(1));webReader.show(Number(q.get('chapter')),0,q.get('anchor')||'');}else rendition.display(item.href).catch(e=>status('章節載入失敗：'+e.message));if(innerWidth<=700)toggleOutline(false);};
    if(item.disabled)button.disabled=true;
    li.append(button);
    if(item.subitems?.length){const details=document.createElement('details');details.open=true;const summary=document.createElement('summary');summary.textContent='子章節（'+item.subitems.length+'）';details.append(summary,tocTree(item.subitems));li.append(details);}
    ol.append(li);
  }return ol;
}
function toggleOutline(show){document.body.classList.toggle('hide-outline',!show);$('toc-toggle').setAttribute('aria-expanded',show);if(rendition)requestAnimationFrame(()=>rendition.resize());}
async function openBook(id,mode){
  if(busy)return;busy=true;const token=++generation;
  try{
    status('正在載入書籍…');const record=await store.get(id);if(!record)throw new Error('書籍不存在');
    if(webReader){webReader.destroy();webReader=null;}
    if(book){book.destroy();book=null;rendition=null;}active=record;
    $('library').hidden=true;$('reader').hidden=false;$('book-title').textContent=record.title;$('viewport').replaceChildren();
    currentMode=record.type==='pdf'?'pdf':mode||(record.web?'web':'epub');$('reading-mode').value=currentMode;
    for(const element of [$('reading-mode'),$('size').parentElement,$('font'),$('spacing')])element.hidden=currentMode==='pdf';
    if(currentMode==='pdf'){
      const pdf=await PdfReader.load(record.data);webReader=new PdfReader($('viewport'),pdf,record);const position=await store.position(id+':pdf');webReader.rotation=position?.rotation||0;webReader.zoom=position?.zoom||'fit';webReader.toolbar.querySelector('select').value=webReader.zoom;
      await webReader.navigation();await webReader.show(position?.index||0);toggleOutline(innerWidth>700);record.opened=Date.now();await store.put(record);records=records.map(r=>r.id===id?record:r);$('prev').title=$('prev').ariaLabel='上一頁';$('next').title=$('next').ariaLabel='下一頁';status();return;
    }
    if(currentMode==='web'){
      if(!record.web){record.web=await EpubConverter.convert(record.data,(n,total)=>status(`正在轉換：${n} / ${total}`));await store.put(record);}
      await openWeb(record);record.opened=Date.now();await store.put(record);records=records.map(r=>r.id===id?record:r);
      status(record.web.warnings.join('；'));return;
    }
    $('prev').title=$('prev').ariaLabel='上一頁';$('next').title=$('next').ariaLabel='下一頁';
    book=ePub(record.data,{replacements:'blobUrl'});await bounded(book.opened);
    const navigation=await bounded(book.loaded.navigation);tocItems=[];$('toc').replaceChildren(tocTree(navigation.toc.length?navigation.toc:book.spine.spineItems.map((s,i)=>({href:s.href,label:'閱讀段落 '+(i+1)}))));
    rendition=book.renderTo('viewport',{width:'100%',height:'100%',flow:'paginated',spread:'none',allowScriptedContent:false});
      rendition.hooks.content.register(contents=>{
        if(window.ReaderHighlights)window.ReaderHighlights.attach(contents.document.body,contents.sectionIndex,'epub');
      WebBookReader.loadWebFonts(contents.document);
      const rotationKey='epub-image-rotations:'+record.id;
      const rotations=WebBookReader.loadRotations(rotationKey);
      contents.document.querySelectorAll('img').forEach((image,index)=>{
        image.dataset.rotationKey=(contents.cfiBase||contents.sectionIndex)+':'+index;
        const restore=()=>{if(rotations[image.dataset.rotationKey])WebBookReader.rotateInline(image,rotations[image.dataset.rotationKey]);};
        image.addEventListener('load',restore);if(image.complete)restore();
      });
      contents.document.addEventListener('click',event=>{
        const img=event.target.closest('img');if(!img)return;
        event.preventDefault();event.stopPropagation();
        const note=img.getAttribute('zy-footnote');
        const rotation=WebBookReader.rotationFromEvent(event);
        if(rotation&&!note){const key=img.dataset.rotationKey;rotations[key]=((Number(rotations[key])||0)+rotation+360)%360;WebBookReader.rotateInline(img,rotations[key]);try{WebBookReader.saveRotations(rotationKey,rotations);}catch{status('無法儲存圖片旋轉角度。');}return;}
        if(note){$('note').querySelector('p').textContent=note;$('note').showModal();}
        else{disposePicture?.();let content=$('picture').querySelector('.image-viewer');if(!content){$('picture').querySelector('img')?.remove();content=document.createElement('div');content.className='image-viewer';$('picture').append(content);}disposePicture=WebBookReader.imageViewer(content,img.src,img.alt,WebBookReader.rotationFromEvent(event));$('picture').showModal();}
      });
      contents.document.addEventListener('keydown',readingKey);
    });
    rendition.on('relocated',location=>{
      if(token!==generation)return;
      const section=book.spine.get(location.start.cfi),index=section?.index||0;
      const match=tocItems.find(t=>t.href.split('#')[0]===location.start.href.split('#')[0]);
      $('chapter').textContent=match?.label||'閱讀段落 '+(index+1);
      $('position').textContent=`${index+1} / ${active.sections}`;
      $('prev').disabled=location.atStart;$('next').disabled=location.atEnd;
      document.querySelectorAll('#toc button').forEach(b=>b.classList.toggle('active',b.dataset.href.split('#')[0]===location.start.href.split('#')[0]));
      store.savePosition({id,cfi:location.start.cfi}).catch(()=>status('閱讀位置無法儲存。'));
    });
    theme();toggleOutline(innerWidth>700);
    const position=await store.position(id);
    try{await rendition.display(position?.cfi);}catch{await rendition.display();}
    record.opened=Date.now();await store.put(record);records=records.map(r=>r.id===id?record:r);status();
  }catch(e){status('無法開啟：'+e.message);$('library').hidden=false;$('reader').hidden=true;}finally{busy=false;}
}
async function convertBook(id){
  if(busy)return;busy=true;
  try{const record=await store.get(id);record.web=await EpubConverter.convert(record.data,(n,total)=>status(`正在轉換 ${record.title}：${n} / ${total}`));await store.put(record);records=records.map(r=>r.id===id?record:r);drawShelf();status('網頁版已完成。'+record.web.warnings.join('；'));}
  catch(error){status('轉換失敗，EPUB 原版仍可閱讀：'+error.message);}finally{busy=false;}
}
async function exportBook(id){
  if(busy)return;busy=true;
  try{status('正在打包離線網頁…');const record=await store.get(id);const blob=await WebBookExport.create(record);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=record.title.replace(/[\\/:*?"<>|]/g,'_')+'-網頁版.zip';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);status('離線網頁 ZIP 已送交瀏覽器下載。');}
  catch(error){status('匯出失敗：'+error.message);}finally{busy=false;}
}
async function openWeb(record){
  function navigation(items){return items.map(item=>({label:item.label,href:'#chapter='+item.index+'&anchor='+encodeURIComponent(item.anchor),disabled:item.index<0,subitems:navigation(item.children)}));}
  tocItems=[];$('toc').replaceChildren(tocTree(navigation(record.web.toc)));
  const host=document.createElement('div');host.style.height='100%';$('viewport').append(host);
  const id=record.id;
  webReader=new WebBookReader(host,record.web,position=>{
    store.savePosition({id:id+':web',...position}).catch(()=>status('網頁閱讀位置無法儲存。'));
    $('chapter').textContent=record.web.chapters[position.index].title;$('position').textContent=(position.index+1)+' / '+record.web.chapters.length;
    $('prev').disabled=position.index===0;$('next').disabled=position.index===record.web.chapters.length-1;
    document.querySelectorAll('#toc button').forEach(b=>b.classList.toggle('active',Number(new URLSearchParams(b.dataset.href.slice(1)).get('chapter'))===position.index));
  },{rotationKey:record.id});
  theme();toggleOutline(innerWidth>700);
  const position=await store.position(id+':web');await webReader.show(position?.index||0,position?.fraction||0);
  $('prev').title=$('prev').ariaLabel='上一章';$('next').title=$('next').ariaLabel='下一章';
}
const modeControl=document.createElement('select');modeControl.id='reading-mode';modeControl.setAttribute('aria-label','閱讀模式');modeControl.innerHTML='<option value="web">網頁閱讀</option><option value="epub">EPUB 原版</option>';
WebBookReader.fontOptions($('font'),true);
WebBookReader.fullscreenControl(document.querySelector('.reader-tools'),status);
document.querySelector('.reader-tools').insertBefore(modeControl,$('size').parentElement);
modeControl.onchange=()=>{if(busy){modeControl.value=currentMode;return;}if(active)openBook(active.id,modeControl.value);};
$('files').onchange=e=>importFiles(Array.from(e.target.files));
$('files').accept='.epub,.pdf,application/epub+zip,application/pdf';
const importLabel=$('files').parentElement;for(const node of importLabel.childNodes)if(node.nodeType===3&&node.textContent.trim())node.textContent='匯入書籍';
$('home').onclick=()=>{if(busy)return;++generation;if(webReader){webReader.destroy();webReader=null;}if(book){book.destroy();book=null;rendition=null;}$('library').hidden=false;$('reader').hidden=true;$('book-title').textContent='';drawShelf();status();};
$('search').oninput=drawShelf;$('sort').onchange=drawShelf;
$('size').oninput=e=>{settings.size=Number(e.target.value);theme();saveSettings();};
$('font').onchange=e=>{settings.font=e.target.value;theme();saveSettings();};
$('spacing').onchange=e=>{settings.spacing=e.target.value;theme();saveSettings();};
$('theme').onclick=()=>{settings.dark=!settings.dark;theme();saveSettings();};
$('toc-toggle').onclick=()=>toggleOutline(document.body.classList.contains('hide-outline'));
$('prev').onclick=()=>webReader?webReader.show(webReader.index-1):rendition?.prev().catch(e=>status(e.message));$('next').onclick=()=>webReader?webReader.show(webReader.index+1):rendition?.next().catch(e=>status(e.message));
addEventListener('pagehide',()=>webReader?.notify());
document.addEventListener('dragover',e=>{e.preventDefault();});document.addEventListener('drop',e=>{e.preventDefault();if(e.dataTransfer.files.length)importFiles(Array.from(e.dataTransfer.files));});
theme();icons();
store.all().then(data=>{records=data;drawShelf();startDesktopBridge();}).catch(e=>status('無法開啟本機書庫，請確認瀏覽器允許儲存資料：'+e.message));
function startDesktopBridge(){
  if(!window.desktopReader)return;
  document.querySelector('.old')?.remove();
  let draining=false;
  async function drain(){
    if(draining)return;draining=true;
    try{
      for(;;){
        while(busy)await new Promise(resolve=>setTimeout(resolve,100));
        const entry=await window.desktopReader.next();if(!entry)break;
        if(entry.error){status('無法開啟 '+entry.name+'：'+entry.error);continue;}
        const file=new File([entry.bytes],entry.name,{type:'application/epub+zip'});
        const ids=await importFiles([file]);if(ids.length)await openBook(ids[ids.length-1]);
      }
    }catch(error){status('桌面檔案開啟失敗：'+error.message);}finally{draining=false;}
  }
  window.desktopReader.onOpen(drain);
  window.desktopReader.ready().catch(error=>status(error.message));
}
