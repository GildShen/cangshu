'use strict';
window.WebBookReader = class WebBookReader {
  static fonts=[
    {id:'serif',label:'思源宋體',family:'"Noto Serif TC", "Source Han Serif TC", "Source Han Serif TW", "Noto Serif CJK TC", "PMingLiU", serif'},
    {id:'source-sans',label:'思源黑體',family:'"Noto Sans TC", "Source Han Sans TC", "Source Han Sans TW", "Noto Sans CJK TC", "Microsoft JhengHei", sans-serif'},
    {id:'pmingliu',label:'新細明體',family:'"PMingLiU", "新細明體", serif'},
    {id:'sans-serif',label:'微軟正黑體',family:'"Microsoft JhengHei", "微軟正黑體", sans-serif'}
  ];
  static loadWebFonts(doc=document){
    if(doc.querySelector('link[data-reader-webfonts]'))return;
    const link=doc.createElement('link');link.rel='stylesheet';link.setAttribute('data-reader-webfonts','');link.referrerPolicy='no-referrer';
    link.href='https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700&family=Noto+Serif+TC:wght@400;700&display=swap';
    doc.head.append(link);
  }
  static fontFamily(id){return this.fonts.find(font=>font.id===id)?.family||this.fonts[0].family;}
  static fontOptions(select,original=false){
    select.replaceChildren();
    for(const font of [...this.fonts,...(original?[{id:'original',label:'原書字體'}]:[])]){
      const option=document.createElement('option');option.value=font.id;option.textContent=font.label;select.append(option);
    }
  }
  static inlineStates=new WeakMap();
  static loadRotations(key){try{return JSON.parse(localStorage.getItem(key)||'{}')||{};}catch{return {};}}
  static saveRotations(key,values){localStorage.setItem(key,JSON.stringify(values));}
  static rotateInline(image,angle,maxHeight=innerHeight*.8){
    angle=(angle%360+360)%360;
    let state=this.inlineStates.get(image);
    if(!state){state={style:image.getAttribute('style'),parent:image.parentElement,frame:null};this.inlineStates.set(image,state);}
    if(angle===0){if(state.frame){state.frame.replaceWith(image);state.frame=null;}if(state.style===null)image.removeAttribute('style');else image.setAttribute('style',state.style);return;}
    if(!state.frame){const frame=image.ownerDocument.createElement('span');frame.style.cssText='display:block;position:relative;margin:0 auto;max-width:100%;';image.replaceWith(frame);frame.append(image);state.frame=frame;}
    const width=image.naturalWidth||image.width||1,height=image.naturalHeight||image.height||1,swapped=angle%180!==0;
    const available=state.parent.clientWidth||image.ownerDocument.documentElement.clientWidth||innerWidth*.75;
    const scale=Math.min(available/(swapped?height:width),Math.max(1,maxHeight)/(swapped?width:height));
    state.frame.style.width=(swapped?height:width)*scale+'px';state.frame.style.height=(swapped?width:height)*scale+'px';
    image.style.cssText='position:absolute;display:block;left:50%;top:50%;margin:0;max-width:none;max-height:none;object-fit:contain;';
    image.style.width=width*scale+'px';image.style.height=height*scale+'px';image.style.transform=`translate(-50%, -50%) rotate(${angle}deg)`;
  }
  static fullscreenControl(parent,onError=message=>alert(message)){
    const button=document.createElement('button');button.type='button';parent.append(button);
    const update=()=>{
      const active=!!document.fullscreenElement;
      button.title=active?'離開全螢幕':'全螢幕';button.setAttribute('aria-label',button.title);button.setAttribute('aria-pressed',String(active));
      // Lucide Maximize / Minimize paths, retained in standalone exports.
      const paths=active?['M8 3v3a2 2 0 0 1-2 2H3','M21 8h-3a2 2 0 0 1-2-2V3','M3 16h3a2 2 0 0 1 2 2v3','M16 21v-3a2 2 0 0 1 2-2h3']:['M8 3H5a2 2 0 0 0-2 2v3','M21 8V5a2 2 0 0 0-2-2h-3','M3 16v3a2 2 0 0 0 2 2h3','M16 21h3a2 2 0 0 0 2-2v-3'];
      button.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+paths.map(d=>'<path d="'+d+'"/>').join('')+'</svg>';
    };
    button.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else{if(!document.documentElement.requestFullscreen)throw new Error('此瀏覽器不支援全螢幕，請使用瀏覽器的全螢幕功能。');await document.documentElement.requestFullscreen();}}catch(error){onError('無法切換全螢幕：'+error.message);}update();};
    document.addEventListener('fullscreenchange',update);update();
    return ()=>document.removeEventListener('fullscreenchange',update);
  }
  static rotationFromEvent(event){return event?.ctrlKey?-90:event?.altKey?90:0;}
  static keyboardAllowed(event){
    if(event.defaultPrevented||event.ctrlKey||event.altKey||event.metaKey||event.shiftKey||event.isComposing)return false;
    return !event.composedPath().some(node=>node.matches?.('input,select,textarea,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="slider"]'));
  }
  handleKey(event){
    if(!WebBookReader.keyboardAllowed(event)||this.restoring||this.root.querySelector('dialog').open)return;
    const direction={ArrowLeft:-1,ArrowUp:-1,ArrowRight:1,ArrowDown:1,PageUp:-1,PageDown:1}[event.key];
    if(!direction)return;
    event.preventDefault();
    if(event.key.startsWith('Page')){
      const index=this.index+direction;
      if(index>=0&&index<this.data.chapters.length)this.show(index);
    }else if(this.imageOnly){
      const top=this.scroll.getBoundingClientRect().top;
      const positions=this.pageImages.map(image=>image.closest('.image-page').getBoundingClientRect().top-top+this.scroll.scrollTop-16);
      const next=direction>0?positions.find(position=>position>this.scroll.scrollTop+2):positions.slice().reverse().find(position=>position<this.scroll.scrollTop-2);
      if(next!==undefined){this.scroll.scrollTop=Math.max(0,next);this.notify();}
      else if(this.index+direction>=0&&this.index+direction<this.data.chapters.length)this.show(this.index+direction,direction<0?1:0);
    }else{
      const max=Math.max(0,this.scroll.scrollHeight-this.scroll.clientHeight);
      const target=Math.max(0,Math.min(max,this.scroll.scrollTop+direction*this.scroll.clientHeight*.9));
      if(Math.abs(target-this.scroll.scrollTop)>1){this.scroll.scrollTop=target;this.notify();}
      else if(this.index+direction>=0&&this.index+direction<this.data.chapters.length)this.show(this.index+direction,direction<0?1:0);
    }
  }
  static imageViewer(container,src,alt='',initialAngle=0){
    container.replaceChildren();
    const controls=document.createElement('div'),stage=document.createElement('div'),image=document.createElement('img'),angleLabel=document.createElement('output');
    controls.style.cssText='display:flex;align-items:center;justify-content:center;gap:12px;margin:8px 0';
    stage.style.cssText='width:min(78vw,1000px);height:65vh;display:grid;place-items:center;overflow:hidden';
    image.style.cssText='display:block;max-width:none;max-height:none;margin:0;object-fit:contain';image.alt=alt;
    let angle=(initialAngle%360+360)%360;
    const fit=()=>{
      const width=image.naturalWidth||1,height=image.naturalHeight||1,swapped=angle%180!==0;
      const scale=Math.min((stage.clientWidth||innerWidth*.78)/(swapped?height:width),(stage.clientHeight||innerHeight*.65)/(swapped?width:height));
      image.style.width=width*scale+'px';image.style.height=height*scale+'px';image.style.transform=`rotate(${angle}deg)`;angleLabel.textContent=angle+'°';
    };
    for(const [direction,label] of [[-1,'向左旋轉 90 度'],[1,'向右旋轉 90 度']]){
      const button=document.createElement('button');button.type='button';button.title=label;button.setAttribute('aria-label',label);
      // Lucide RotateCw geometry, embedded so exported readers remain standalone.
      button.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>';
      if(direction<0)button.firstChild.style.transform='scaleX(-1)';
      button.onclick=()=>{angle=(angle+direction*90+360)%360;fit();};controls.append(button);
    }
    angleLabel.setAttribute('aria-live','polite');controls.append(angleLabel);stage.append(image);container.append(controls,stage);
    const disposeFullscreen=WebBookReader.fullscreenControl(controls);
    image.onclick=event=>{const rotation=WebBookReader.rotationFromEvent(event);if(!rotation)return;event.preventDefault();event.stopPropagation();angle=(angle+rotation+360)%360;fit();};
    image.onload=fit;image.src=src;fit();
    const observer=typeof ResizeObserver==='function'?new ResizeObserver(fit):null;observer?.observe(stage);
    return ()=>{observer?.disconnect();disposeFullscreen();image.onload=null;image.onclick=null;};
  }
  constructor(host,data,onChange=()=>{},options={}) {
    WebBookReader.loadWebFonts(host.ownerDocument);
    this.data=data;this.onChange=onChange;this.index=0;this.restoring=false;
    this.rotationKey='web-image-rotations:'+(options.rotationKey||data.created||'default');
    this.rotations=WebBookReader.loadRotations(this.rotationKey);
    this.root=host.attachShadow({mode:'open'});
    this.root.innerHTML=`<style>
      :host{display:block;height:100%;min-width:0}*{box-sizing:border-box;letter-spacing:0}.scroll{height:100%;overflow:auto;scrollbar-gutter:stable;background:var(--paper,#fff);color:var(--ink,#252e29)}article{max-width:820px;margin:auto;padding:40px 42px 80px;font-size:var(--size,22px);font-family:var(--font,serif);line-height:var(--leading,1.8);overflow-wrap:anywhere}p{margin:1em 0}h1,h2,h3,h4,h5,h6{line-height:1.5;margin:1em 0}h1{font-size:1.6em}h2{font-size:1.4em}h3{font-size:1.2em}img{max-width:100%;height:auto;cursor:zoom-in}div>img,figure>img{display:block;margin:20px auto}img[data-note]{display:inline;width:.7em;height:auto;margin:0 .1em;vertical-align:super;cursor:pointer}a{color:var(--green,#426a52)}table{display:block;overflow:auto;max-width:100%;border-collapse:collapse}th,td{border:1px solid #aaa;padding:8px}blockquote{border-left:3px solid #9ba99f;margin:1em 0;padding-left:1em}pre{white-space:pre-wrap}figure{margin:1em 0}figcaption{font-size:.85em}dialog{max-width:92vw;max-height:88vh;border:1px solid #aaa;border-radius:5px;background:var(--paper,#fff);color:var(--ink,#252e29);padding:18px}dialog::backdrop{background:#0008}dialog img{display:block;max-width:85vw;max-height:72vh;object-fit:contain}dialog form{text-align:right}button{font:16px sans-serif;padding:8px;cursor:pointer}dialog p{max-width:600px;line-height:1.8;white-space:pre-wrap}@media(max-width:700px){article{padding:26px 22px 70px}}
      </style><div class="scroll" tabindex="0" aria-label="章節正文"><article></article></div><dialog><form method="dialog"><button>關閉</button></form><div class="detail"></div></dialog>`;
    this.scroll=this.root.querySelector('.scroll');this.article=this.root.querySelector('article');
    const imageStyle=document.createElement('style');
    imageStyle.textContent='article.image-only{padding:16px;max-width:none}article.image-only div,article.image-only p,article.image-only figure,article.image-only a{margin:0;padding:0;line-height:0}article.image-only img{display:block;width:auto;height:auto;max-width:100%;max-height:var(--image-height,70vh);object-fit:contain;margin:0 auto}';
    this.root.append(imageStyle);
    imageStyle.textContent+='article.image-only .image-page{height:var(--image-height,70vh);display:flex;align-items:center;justify-content:center}';
    const resizeImages=()=>{this.article.style.setProperty('--image-height',Math.max(1,this.scroll.clientHeight-32)+'px');for(const image of this.article.querySelectorAll('img[data-rotation-key]')){const angle=this.rotations[image.dataset.rotationKey];if(angle)WebBookReader.rotateInline(image,angle,this.scroll.clientHeight-32);}};
    this.imageResize=typeof ResizeObserver==='function'?new ResizeObserver(resizeImages):null;
    this.imageResize?.observe(this.scroll);resizeImages();
    this.scroll.addEventListener('scroll',()=>{clearTimeout(this.timer);this.timer=setTimeout(()=>this.notify(),150);});
    this.article.addEventListener('click',e=>this.activate(e));
    this.article.addEventListener('keydown',e=>{if(e.target.matches('[data-note]')&&['Enter',' '].includes(e.key))this.activate(e);});
  }
  fraction(){return this.scroll.scrollTop/Math.max(1,this.scroll.scrollHeight-this.scroll.clientHeight);}
  notify(){if(!this.restoring)this.onChange({index:this.index,fraction:Math.min(1,Math.max(0,this.fraction()))});}
  settings(value){
    const fraction=this.fraction();
    this.scroll.style.setProperty('--size',value.size+'px');
    this.scroll.style.setProperty('--leading',value.spacing);
    this.scroll.style.setProperty('--font',WebBookReader.fontFamily(value.font));
    this.scroll.style.setProperty('--paper',value.dark?'#202622':'#ffffff');this.scroll.style.setProperty('--ink',value.dark?'#e7ece8':'#252e29');
    this.scroll.scrollTop=fraction*Math.max(0,this.scroll.scrollHeight-this.scroll.clientHeight);
  }
  async show(index,fraction=0,anchor=''){
    this.restoring=true;const serial=this.serial=(this.serial||0)+1;
    this.index=Math.max(0,Math.min(this.data.chapters.length-1,Number(index)||0));
    this.article.innerHTML=this.data.chapters[this.index].html;
    const images=Array.from(this.article.querySelectorAll('img[data-asset]'));
    this.pageImages=images.filter(image=>!image.hasAttribute('data-note'));
    this.imageOnly=this.pageImages.length>0&&!this.article.textContent.trim();
    this.article.classList.toggle('image-only',this.imageOnly);
    if(this.imageOnly)for(const image of this.pageImages){const page=document.createElement('div');page.className='image-page';image.replaceWith(page);page.append(image);}
    this.article.style.setProperty('--image-height',Math.max(1,this.scroll.clientHeight-32)+'px');
    for(const [i,img] of images.entries()){
      img.dataset.rotationKey=this.index+':'+i+':'+img.dataset.asset;
      img.onload=()=>{const angle=this.rotations[img.dataset.rotationKey];if(angle)WebBookReader.rotateInline(img,angle,this.scroll.clientHeight-32);};
      img.src=this.data.assets[img.dataset.asset];
      if(this.rotations[img.dataset.rotationKey])img.onload();
    }
    // Restore only after image dimensions have settled, with a bounded wait.
    if(fraction||anchor){let timeout;await Promise.race([Promise.all(images.map(img=>img.decode?.().catch(()=>{}))),new Promise(done=>{timeout=setTimeout(done,3000);})]);clearTimeout(timeout);}
    if(serial!==this.serial)return;
    this.scroll.scrollTop=Math.max(0,Math.min(1,Number(fraction)||0))*Math.max(0,this.scroll.scrollHeight-this.scroll.clientHeight);
    if(anchor)this.root.getElementById(anchor)?.scrollIntoView({block:'start'});
      this.restoring=false;this.notify();
      if(window.ReaderHighlights)window.ReaderHighlights.attach(this.article,this.index,'web');
  }
  activate(event){
    const target=event.target.closest('img,a');if(!target)return;
    if(target.tagName==='IMG'){
      const rotation=WebBookReader.rotationFromEvent(event);
      if(rotation&&!target.dataset.note){
        event.preventDefault();event.stopPropagation();
        const key=target.dataset.rotationKey,angle=((Number(this.rotations[key])||0)+rotation+360)%360;
        this.rotations[key]=angle;WebBookReader.rotateInline(target,angle,this.scroll.clientHeight-32);
        try{WebBookReader.saveRotations(this.rotationKey,this.rotations);}catch{console.warn('無法儲存圖片旋轉角度');}
        return;
      }
      event.preventDefault();const detail=this.root.querySelector('.detail');detail.replaceChildren();
      this.disposeImage?.();
      if(target.dataset.note){const p=document.createElement('p');p.textContent=target.dataset.note;detail.append(p);}else{this.disposeImage=WebBookReader.imageViewer(detail,target.src,target.alt,this.rotations[target.dataset.rotationKey]||0);}
      this.root.querySelector('dialog').showModal();return;
    }
    const href=target.getAttribute('href');
    if(href?.startsWith('#chapter=')){event.preventDefault();const query=new URLSearchParams(href.slice(1));this.show(Number(query.get('chapter')),0,query.get('anchor')||'');}
  }
  destroy(){this.notify();this.serial++;clearTimeout(this.timer);this.disposeImage?.();this.imageResize?.disconnect();}
};
