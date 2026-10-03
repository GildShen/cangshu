const {app,BrowserWindow,Menu,dialog,ipcMain,protocol,net,session,shell,clipboard,safeStorage}=require('electron');
const path=require('node:path');
const fs=require('node:fs/promises');
const {pathToFileURL}=require('node:url');
const {epubArguments,assetPath}=require('./paths.cjs');
const {AiService}=require('./ai-service.cjs');
const origin='reader://app/index.html';
app.setName('藏書');
const smoke=!app.isPackaged&&process.env.CANGSHU_SMOKE==='1';
app.setPath('userData',smoke?path.join(__dirname,'.smoke-profile'):path.join(app.getPath('appData'),'CangshuReader'));
protocol.registerSchemesAsPrivileged([{scheme:'reader',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true}}]);
let window,ready=false;
const pending=[];
function enqueue(files){pending.push(...files);if(ready&&window&&!window.isDestroyed())window.webContents.send('books:available');}
function trusted(event){return window&&event.sender===window.webContents&&event.senderFrame===window.webContents.mainFrame&&event.senderFrame.url===origin;}
async function chooseFiles(){const result=await dialog.showOpenDialog(window,{title:'開啟電子書',properties:['openFile','multiSelections'],filters:[{name:'EPUB / PDF',extensions:['epub','pdf']}]});if(!result.canceled)enqueue(result.filePaths);}
if(!app.requestSingleInstanceLock())app.quit();
else{
  enqueue(epubArguments(process.argv));
  app.on('second-instance',(_event,args,cwd)=>{enqueue(epubArguments(args,cwd));if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
  app.on('open-file',(event,file)=>{event.preventDefault();enqueue(epubArguments([file]));});
  app.whenReady().then(async()=>{
    app.setAppUserModelId('local.cangshu.reader');
    const root=app.isPackaged?path.join(__dirname,'reader'):path.join(__dirname,'../ebook-browser');
    protocol.handle('reader',request=>{try{return net.fetch(pathToFileURL(assetPath(root,request.url)).href);}catch{return new Response('Not found',{status:404});}});
    session.defaultSession.setPermissionRequestHandler((_contents,permission,callback)=>callback(permission==='fullscreen'));
    session.defaultSession.setPermissionCheckHandler((_contents,permission)=>permission==='fullscreen');
    session.defaultSession.webRequest.onHeadersReceived((details,callback)=>{
      const headers={...details.responseHeaders};
      if(details.url.startsWith('reader://app/'))headers['Content-Security-Policy']=["default-src 'self' data: blob:; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: blob: https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' data: blob:; object-src 'none'; base-uri 'none'"];
      callback({responseHeaders:headers});
    });
    window=new BrowserWindow({width:1280,height:900,minWidth:620,minHeight:500,title:'藏書',icon:path.join(__dirname,'icon.png'),show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false,webSecurity:true,offscreen:smoke,backgroundThrottling:!smoke}});
    window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
    window.webContents.on('will-navigate',(event,url)=>{if(url!==origin)event.preventDefault();});
    window.webContents.on('will-attach-webview',event=>event.preventDefault());
    window.webContents.on('did-start-navigation',(_event,_url,_inPlace,isMainFrame)=>{if(isMainFrame)ready=false;});
    window.once('ready-to-show',()=>{if(!smoke)window.show();});
    const ai=new AiService(app.getPath('userData'),{safeStorage});
    const guard=event=>{if(!trusted(event))throw Error('Invalid sender');};
    ipcMain.handle('ai:run',async(event,request)=>{guard(event);try{return {ok:true,...await ai.run(request)};}catch(error){return {ok:false,error:error.message,usage:error.usage||null};}});
    ipcMain.handle('ai:cancel',event=>{guard(event);return ai.cancel();});
    ipcMain.handle('ai:copy',(event,text)=>{guard(event);if(typeof text!=='string'||text.length>200000)throw Error('Invalid text');clipboard.writeText(text);});
    ipcMain.handle('ai:check',event=>{guard(event);return ai.check();});
    ipcMain.handle('ai:info',event=>{guard(event);return ai.info();});
    ipcMain.handle('ai:configure',async(event,change)=>{guard(event);if(typeof change==='string')change={model:change};if(!change||typeof change!=='object'||Array.isArray(change))throw Error('Invalid settings');const allowed={};for(const key of ['provider','model','apiModel','apiKey','removeKey'])if(Object.hasOwn(change,key))allowed[key]=change[key];await ai.configure(allowed);return ai.check();});
    ipcMain.handle('ai:choose-cli',async event=>{guard(event);const result=await dialog.showOpenDialog(window,{title:'選擇 Codex CLI',filters:[{name:'Codex 執行檔',extensions:['exe']}],properties:['openFile']});if(!result.canceled)await ai.configure({cliPath:result.filePaths[0]});return ai.check();});
    window.on('closed',()=>ai.cancel());
    window.webContents.on('did-start-navigation',(_event,_url,_inPlace,isMainFrame)=>{if(isMainFrame)ai.cancel();});
    ipcMain.handle('books:ready',event=>{if(!trusted(event))throw new Error('Invalid sender');ready=true;if(pending.length)window.webContents.send('books:available');});
    ipcMain.handle('books:next',async event=>{
      if(!trusted(event))throw new Error('Invalid sender');
      const file=pending.shift();if(!file)return null;
      try{const stat=await fs.stat(file);if(!stat.isFile()||!['.epub','.pdf'].includes(path.extname(file).toLowerCase()))throw new Error('不是 EPUB 或 PDF 檔案');if(stat.size>1024*1024*1024)throw new Error('檔案超過 1 GB');const bytes=await fs.readFile(file);app.addRecentDocument(file);return {name:path.basename(file),bytes};}
      catch(error){return {name:path.basename(file),error:error.message};}
    });
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      {label:'檔案',submenu:[{label:'開啟 EPUB / PDF…',accelerator:'CmdOrCtrl+O',click:chooseFiles},{label:'設定預設閱讀器',click:()=>shell.openExternal('ms-settings:defaultapps')},{type:'separator'},{role:'quit',label:'結束'}]},
      {label:'編輯',submenu:[{role:'copy',label:'複製'},{role:'selectAll',label:'全選'}]},
      {label:'檢視',submenu:[{role:'togglefullscreen',label:'全螢幕'},{role:'reload',label:'重新載入'}]},
      {label:'說明',submenu:[{label:'關於藏書',click:()=>dialog.showMessageBox(window,{title:'藏書',message:'藏書 '+app.getVersion(),detail:'EPUB 與網頁電子書閱讀器\n書庫位置：'+app.getPath('userData')})}]}
    ]));
    await window.loadURL(origin);
  }).catch(error=>{dialog.showErrorBox('藏書啟動失敗',error.message);app.quit();});
  app.on('window-all-closed',()=>app.quit());
}
