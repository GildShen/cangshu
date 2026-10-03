'use strict';
window.PdfReader=class PdfReader{
 static async load(data){await window.PdfReady;const task=pdfjsLib.getDocument({data:new Uint8Array(data.slice(0)),isEvalSupported:false,cMapUrl:new URL('vendor/pdf/cmaps/',document.baseURI).href,cMapPacked:true,standardFontDataUrl:new URL('vendor/pdf/standard_fonts/',document.baseURI).href,wasmUrl:new URL('vendor/pdf/wasm/',document.baseURI).href});try{const pdf=await task.promise;pdf.destroy=()=>task.destroy();return pdf;}catch(error){await task.destroy();throw error;}}
 static async metadata(data){const pdf=await this.load(data);try{const meta=await pdf.getMetadata().catch(()=>({info:{}}));return {title:meta.info.Title,author:meta.info.Author,sections:pdf.numPages};}finally{await pdf.destroy();}}
 constructor(host,pdf,record){
  this.pdf=pdf;this.record=record;this.index=0;this.serial=0;this.rotation=0;this.zoom='fit';this.root=document;this.dead=false;
  this.toolbar=document.createElement('div');this.toolbar.className='pdf-tools';this.toolbar.innerHTML='<label>頁碼 <input aria-label="PDF 頁碼" type="number" min="1" value="1"></label><select aria-label="PDF 縮放"><option value="fit">符合頁寬</option><option value="0.75">75%</option><option value="1">100%</option><option value="1.5">150%</option><option value="2">200%</option></select><button title="向右旋轉" aria-label="向右旋轉"><i data-lucide="rotate-cw"></i></button><input type="search" aria-label="搜尋 PDF" placeholder="搜尋文件"><button aria-label="尋找下一頁" title="尋找下一頁"><i data-lucide="search"></i></button><span role="status"></span>';
  this.scroll=document.createElement('div');this.scroll.className='pdf-scroll';this.page=document.createElement('div');this.page.className='pdf-page';this.scroll.append(this.page);host.append(this.scroll);document.querySelector('.reader-tools').insertBefore(this.toolbar,$('theme'));host.classList.add('pdf-host');this.host=host;
  this.pageInput=this.toolbar.querySelector('input');this.pageInput.max=pdf.numPages;this.pageInput.onchange=()=>this.show(Number(this.pageInput.value)-1).catch(e=>status(e.message));
  this.toolbar.querySelector('select').onchange=e=>{this.zoom=e.target.value;this.show(this.index).catch(e=>status(e.message));};
  this.toolbar.querySelector('[aria-label="向右旋轉"]').onclick=()=>{this.rotation=(this.rotation+90)%360;this.show(this.index).catch(e=>status(e.message));};
  const search=this.toolbar.querySelector('input[type=search]');this.toolbar.querySelector('[aria-label="尋找下一頁"]').onclick=()=>this.search(search.value);search.onkeydown=e=>{if(e.key==='Enter')this.search(search.value);};
  this.resize=new ResizeObserver(()=>{clearTimeout(this.resizeTimer);this.resizeTimer=setTimeout(()=>{if(!this.dead&&this.zoom==='fit')this.show(this.index).catch(e=>status(e.message));},180);});this.resize.observe(this.scroll);
  icons();
 }
 settings(){}
 fraction(){return 0;}
 notify(){if(!this.dead)store.savePosition({id:this.record.id+':pdf',index:this.index,rotation:this.rotation,zoom:this.zoom}).catch(e=>status(e.message));}
 async show(index){
  if(this.dead)return;const serial=++this.serial;this.renderTask?.cancel();this.textTask?.cancel();this.index=Math.max(0,Math.min(this.pdf.numPages-1,Number(index)||0));
  try{
   const page=await this.pdf.getPage(this.index+1);if(this.dead||serial!==this.serial)return;
   const base=page.getViewport({scale:1,rotation:(page.rotate+this.rotation)%360});const scale=this.zoom==='fit'?Math.max(.2,(this.scroll.clientWidth-32)/base.width):Number(this.zoom);
   const viewport=page.getViewport({scale,rotation:(page.rotate+this.rotation)%360});const canvas=document.createElement('canvas');const ratio=Math.min(devicePixelRatio||1,2,Math.sqrt(16000000/(viewport.width*viewport.height)));
   canvas.width=Math.ceil(viewport.width*ratio);canvas.height=Math.ceil(viewport.height*ratio);canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
   this.article=document.createElement('div');this.article.className='textLayer';this.page.replaceChildren(canvas,this.article);this.page.style.width=viewport.width+'px';this.page.style.height=viewport.height+'px';this.page.style.setProperty('--total-scale-factor',scale);this.page.style.setProperty('--scale-factor',scale);
   this.renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport,transform:[ratio,0,0,ratio,0,0]});await this.renderTask.promise;if(this.dead||serial!==this.serial)return;
   this.textTask=new pdfjsLib.TextLayer({textContentSource:page.streamTextContent(),container:this.article,viewport});await this.textTask.render();if(this.dead||serial!==this.serial)return;
   this.pageInput.value=this.index+1;$('chapter').textContent='第 '+(this.index+1)+' 頁';$('position').textContent=(this.index+1)+' / '+this.pdf.numPages;$('prev').disabled=this.index===0;$('next').disabled=this.index===this.pdf.numPages-1;
   ReaderHighlights?.attach(this.article,this.index,'pdf');this.scroll.scrollTop=0;this.notify();
  }catch(error){if(error.name!=='RenderingCancelledException'&&error.name!=='AbortException'&&!this.dead)throw error;}
 }
 async search(query){
  query=query.trim().toLocaleLowerCase();if(!query||this.searching)return;this.searching=true;const output=this.toolbar.querySelector('[role=status]');
  try{for(let n=1;n<=this.pdf.numPages;n++){if(this.dead)return;const index=(this.index+n)%this.pdf.numPages;output.textContent='搜尋 '+(index+1)+' / '+this.pdf.numPages;const page=await this.pdf.getPage(index+1);const content=await page.getTextContent();if(content.items.map(i=>i.str||'').join(' ').toLocaleLowerCase().includes(query)){await this.show(index);output.textContent='找到第 '+(index+1)+' 頁';return;}}output.textContent='找不到符合文字';}catch(error){output.textContent=error.message;}finally{this.searching=false;}
 }
 handleKey(event){if(!WebBookReader.keyboardAllowed(event))return;const d={ArrowLeft:-1,ArrowUp:-1,PageUp:-1,ArrowRight:1,ArrowDown:1,PageDown:1}[event.key];if(d){event.preventDefault();this.show(this.index+d).catch(e=>status(e.message));}}
 async navigation(){
  $('toc').replaceChildren();const outline=await this.pdf.getOutline();
  const tabs=document.createElement('div');tabs.style.cssText='display:flex;padding:0 12px 12px;gap:8px';const outlines=document.createElement('div'),thumbnails=document.createElement('div');thumbnails.hidden=true;
  for(const [label,target,other] of [['文件目錄',outlines,thumbnails],['頁面縮圖',thumbnails,outlines]]){const button=document.createElement('button');button.textContent=label;button.onclick=()=>{target.hidden=false;other.hidden=true;};tabs.append(button);}$('toc').append(tabs,outlines,thumbnails);
  let chain=Promise.resolve();this.thumbs=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;this.thumbs.unobserve(entry.target);chain=chain.then(async()=>{if(this.dead)return;const page=await this.pdf.getPage(Number(entry.target.dataset.page));if(this.dead)return;const viewport=page.getViewport({scale:130/page.getViewport({scale:1}).width});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;if(!this.dead)entry.target.prepend(canvas);}).catch(()=>{});}}, {root:$('outline'),rootMargin:'150px'});
  for(let i=0;i<this.pdf.numPages;i++){const button=document.createElement('button');button.dataset.page=i+1;button.className='pdf-thumbnail';button.textContent='第 '+(i+1)+' 頁';button.onclick=()=>this.show(i).catch(e=>status(e.message));thumbnails.append(button);this.thumbs.observe(button);}
  const append=(items,parent)=>{for(const item of items){const b=document.createElement('button');b.textContent=item.title;b.onclick=async()=>{try{const dest=typeof item.dest==='string'?await this.pdf.getDestination(item.dest):item.dest;if(dest)await this.show(typeof dest[0]==='number'?dest[0]:await this.pdf.getPageIndex(dest[0]));}catch(e){status(e.message);}};parent.append(b);if(item.items?.length){const nested=document.createElement('div');nested.style.paddingLeft='12px';parent.append(nested);append(item.items,nested);}}};
  if(outline?.length)append(outline,outlines);else{const text=document.createElement('p');text.textContent='此 PDF 沒有文件目錄';text.style.padding='0 20px';outlines.append(text);}
 }
 destroy(){this.notify();this.dead=true;this.serial++;clearTimeout(this.resizeTimer);this.resize.disconnect();this.thumbs?.disconnect();this.renderTask?.cancel();this.textTask?.cancel();this.pdf.destroy().catch(()=>{});this.toolbar.remove();this.host.classList.remove('pdf-host');}
};
