'use strict';
window.WebBookExport = (() => {
  function startExportedBook() {
    const data=JSON.parse(document.getElementById('data').textContent),$=id=>document.getElementById(id);
    let position={},settings={size:22,font:'serif',spacing:'1.8',dark:false};
    const key='offline-web-'+data.id;
    WebBookReader.fontOptions($('font'));
    try{const saved=JSON.parse(localStorage.getItem(key)||'{}');position=saved.position||{};Object.assign(settings,saved.settings||{});}catch{}
    function persist(){try{localStorage.setItem(key,JSON.stringify({position,settings}));}catch{}}
    const reader=new WebBookReader($('page'),data.web,p=>{position=p;persist();$('chapter').textContent=data.web.chapters[p.index].title;$('count').textContent=(p.index+1)+' / '+data.web.chapters.length;$('prev').disabled=p.index===0;$('next').disabled=p.index===data.web.chapters.length-1;},{rotationKey:data.id});
    WebBookReader.fullscreenControl(document.querySelector('header'));
    function toc(items){const ol=document.createElement('ol');for(const item of items){const li=document.createElement('li'),button=document.createElement('button');button.textContent=item.label;button.disabled=item.index<0;button.onclick=()=>{reader.show(item.index,0,item.anchor);if(innerWidth<700)$('toc').hidden=true;};li.append(button);if(item.children.length)li.append(toc(item.children));ol.append(li);}return ol;}
    $('toc').append(toc(data.web.toc));$('title').textContent=data.title;document.title=data.title;
    $('prev').onclick=()=>reader.show(reader.index-1);$('next').onclick=()=>reader.show(reader.index+1);
    $('menu').onclick=()=>{$('toc').hidden=!$('toc').hidden;};
    function apply(){reader.settings(settings);document.body.classList.toggle('dark',settings.dark);$('size').value=settings.size;$('value').textContent=settings.size;$('font').value=settings.font;$('spacing').value=settings.spacing;persist();}
    $('size').oninput=e=>{settings.size=Number(e.target.value);apply();};$('font').onchange=e=>{settings.font=e.target.value;apply();};$('spacing').onchange=e=>{settings.spacing=e.target.value;apply();};$('theme').onclick=()=>{settings.dark=!settings.dark;apply();};
    $('toc').hidden=innerWidth<700;apply();reader.show(position.index||0,position.fraction||0);
    addEventListener('pagehide',()=>reader.notify());
    document.addEventListener('keydown',event=>reader.handleKey(event));
  }
  async function create(record) {
    if(!record.web)throw new Error('請先轉換網頁版');
    const payload=JSON.stringify({id:record.id,title:record.title,web:record.web}).replace(/</g,'\\u003c');
    const html=`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>電子書</title><style>
    *{box-sizing:border-box;letter-spacing:0}body{margin:0;font:16px "Microsoft JhengHei",sans-serif;--paper:#fff;--ink:#252e29;background:var(--paper);color:var(--ink)}body.dark{--paper:#202622;--ink:#e7ece8}header,footer{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid #aab2ac;flex-wrap:wrap}header strong{flex:1;min-width:120px;font-size:18px}button,select,input{font:inherit;color:inherit}button,select{background:var(--paper);border:1px solid #aab2ac;border-radius:4px;padding:7px;cursor:pointer}header label{display:flex;align-items:center;gap:6px}input{width:90px}main{display:flex;flex:1;min-height:0}body{height:100dvh;display:flex;flex-direction:column}nav{width:260px;overflow:auto;flex-shrink:0;border-right:1px solid #aab2ac}nav ol{list-style:none;padding:0 0 0 12px}nav button{border:0;text-align:left;line-height:1.6;width:100%;overflow-wrap:anywhere}#page{flex:1;min-width:0}footer{border-top:1px solid #aab2ac;border-bottom:0;font-size:14px}#chapter{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}[hidden]{display:none!important}@media(max-width:700px){nav{position:absolute;top:120px;bottom:60px;z-index:2;background:var(--paper);width:85vw}header{gap:7px;padding:10px}header strong{width:70%}}</style>
    <header><button id="menu" aria-label="開關目錄">☰</button><strong id="title"></strong><label>字級<input id="size" type="range" min="16" max="36"><output id="value"></output></label><select id="font" aria-label="字體"><option value="serif">宋體</option><option value="sans-serif">黑體</option></select><select id="spacing" aria-label="行距"><option value="1.8">標準行距</option><option value="2.1">寬鬆行距</option><option value="1.5">緊湊行距</option></select><button id="theme">日／夜</button></header><main><nav id="toc" aria-label="章節目錄"></nav><div id="page"></div></main><footer><button id="prev" aria-label="上一章">←</button><span id="chapter"></span><span id="count"></span><button id="next" aria-label="下一章">→</button></footer><script id="data" type="application/json">${payload}</script><script>window.WebBookReader=${WebBookReader.toString()};(${startExportedBook.toString()})();</script></html>`;
    const zip=new JSZip();zip.file('index.html',html);zip.file('README.txt','解壓縮後，以 Chrome 或 Edge 開啟 index.html。圖片與正文均已內嵌，不需伺服器或網路。');
    return zip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6}});
  }
  return {create};
})();
