'use strict';
window.EpubConverter = (() => {
  const elements = (node, tag) => Array.from(node.getElementsByTagNameNS('*', tag));
  function resolve(base, reference) {
    const url = new URL(reference, 'https://epub.invalid/' + base);
    if (url.origin !== 'https://epub.invalid') return null;
    return {path:decodeURIComponent(url.pathname.slice(1)),anchor:decodeURIComponent(url.hash.slice(1))};
  }
  async function convert(data, report = () => {}) {
    const zip = await JSZip.loadAsync(data), warnings = [];
    async function xml(path) {
      const file = zip.file(path);
      if (!file) throw new Error('缺少檔案：' + path);
      const doc = new DOMParser().parseFromString(await file.async('string'), 'application/xml');
      if (elements(doc,'parsererror').length) throw new Error('無法解析：' + path);
      return doc;
    }
    const container = await xml('META-INF/container.xml');
    const packagePath = elements(container,'rootfile')[0]?.getAttribute('full-path');
    if (!packagePath) throw new Error('找不到書籍結構');
    const opf = await xml(packagePath), manifest = new Map();
    for (const item of elements(opf,'item')) {
      const target = resolve(packagePath,item.getAttribute('href'));
      if (target) manifest.set(item.getAttribute('id'),{path:target.path,type:item.getAttribute('media-type'),properties:item.getAttribute('properties')||''});
    }
    const paths = elements(opf,'itemref').map(e=>manifest.get(e.getAttribute('idref'))?.path).filter(Boolean);
    if (!paths.length) throw new Error('書籍沒有閱讀段落');
    const assetByPath = new Map(), assets = {};
    for (const item of manifest.values()) {
      if (!item.type?.startsWith('image/')) continue;
      const file = zip.file(item.path);
      if (!file) {warnings.push('缺少圖片：'+item.path);continue;}
      const key = 'image-' + assetByPath.size;
      assetByPath.set(item.path,key);
      assets[key] = 'data:' + item.type + ';base64,' + await file.async('base64');
    }
    const chapters = [];
    for (let index=0;index<paths.length;index++) {
      report(index+1,paths.length);
      const doc = await xml(paths[index]);
      const body = elements(doc,'body')[0];
      if (!body) throw new Error('章節缺少正文：'+paths[index]);
      // Normalize SVG image wrappers used by EPUB cover pages.
      for (const svg of elements(body,'svg')) {
        const picture = elements(svg,'image')[0];
        if (picture) {
          const img=doc.createElement('img');
          img.setAttribute('src',picture.getAttribute('href')||picture.getAttributeNS('http://www.w3.org/1999/xlink','href')||'');
          svg.replaceWith(img);
        } else warnings.push('略過內嵌向量圖：'+paths[index]);
      }
      for (const img of elements(body,'img')) {
        const target=resolve(paths[index],img.getAttribute('src')||'');
        const asset=target&&assetByPath.get(target.path);
        if (asset) img.setAttribute('data-asset',asset);
        else warnings.push('圖片無法轉換：'+(img.getAttribute('src')||paths[index]));
        if (img.hasAttribute('zy-footnote')) {
          img.setAttribute('data-note',img.getAttribute('zy-footnote'));
          img.setAttribute('role','button');img.setAttribute('tabindex','0');
          img.setAttribute('aria-label','閱讀註解');
        }
        img.removeAttribute('src');img.removeAttribute('srcset');
      }
      for (const a of elements(body,'a')) {
        const href=a.getAttribute('href');if(!href)continue;
        const target=resolve(paths[index],href);
        if (target && paths.includes(target.path)) {
          a.setAttribute('href','#chapter='+paths.indexOf(target.path)+'&anchor='+encodeURIComponent(target.anchor));
        } else if (/^https?:\/\//i.test(href)) {
          a.setAttribute('target','_blank');a.setAttribute('rel','noopener noreferrer');
        } else a.removeAttribute('href');
      }
      const html = DOMPurify.sanitize(body.innerHTML,{
        ALLOWED_TAGS:['div','section','article','p','span','h1','h2','h3','h4','h5','h6','br','hr','b','strong','i','em','u','s','small','sup','sub','blockquote','pre','code','ul','ol','li','dl','dt','dd','table','thead','tbody','tfoot','tr','th','td','caption','colgroup','col','figure','figcaption','img','a','ruby','rt','rp','aside'],
        ALLOWED_ATTR:['id','href','alt','width','height','colspan','rowspan','scope','start','value','target','rel','role','tabindex','aria-label','data-asset','data-note'],
        ALLOW_DATA_ATTR:false
      });
      chapters.push({title:elements(doc,'title')[0]?.textContent.trim()||'閱讀段落 '+(index+1),path:paths[index],html});
      await new Promise(done=>setTimeout(done,0));
    }
    function entry(label,href,base,children) {
      const target=href&&resolve(base,href);
      return {label:label.trim()||'未命名章節',index:target?paths.indexOf(target.path):-1,anchor:target?.anchor||'',children};
    }
    let toc=[];
    const navItem=Array.from(manifest.values()).find(i=>i.properties.split(/\s+/).includes('nav'));
    try {
      if(navItem){
        const doc=await xml(navItem.path);
        const nav=elements(doc,'nav').find(n=>(n.getAttribute('epub:type')||n.getAttributeNS('http://www.idpf.org/2007/ops','type')||'').split(/\s+/).includes('toc'));
        function walk(list){return Array.from(list?.children||[]).filter(n=>n.localName==='li').map(li=>{const label=Array.from(li.children).find(n=>['a','span'].includes(n.localName));return entry(label?.textContent||'',label?.getAttribute('href'),navItem.path,walk(Array.from(li.children).find(n=>n.localName==='ol')));});}
        if(nav)toc=walk(Array.from(nav.children).find(n=>n.localName==='ol'));
      }
      if(!toc.length){
        const ncx=Array.from(manifest.values()).find(i=>i.type==='application/x-dtbncx+xml');
        if(ncx){const doc=await xml(ncx.path);function walk(node){return Array.from(node?.children||[]).filter(n=>n.localName==='navPoint').map(n=>entry(elements(n,'navLabel')[0]?.textContent||'',Array.from(n.children).find(e=>e.localName==='content')?.getAttribute('src'),ncx.path,walk(n)));}toc=walk(elements(doc,'navMap')[0]);}
      }
    }catch(error){warnings.push('目錄改用閱讀順序：'+error.message);}
    if(!toc.length)toc=chapters.map((c,index)=>({label:c.title,index,anchor:'',children:[]}));
    return {version:1,chapters,toc,assets,warnings:Array.from(new Set(warnings)),created:Date.now()};
  }
  return {convert};
})();
