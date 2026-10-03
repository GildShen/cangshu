const {contextBridge,ipcRenderer}=require('electron');
if(process.isMainFrame){
  contextBridge.exposeInMainWorld('desktopReader',{
    aiRun:request=>ipcRenderer.invoke('ai:run',request),
    aiCancel:()=>ipcRenderer.invoke('ai:cancel'),
    aiCopy:text=>ipcRenderer.invoke('ai:copy',text),
    aiCheck:()=>ipcRenderer.invoke('ai:check'),
    aiInfo:()=>ipcRenderer.invoke('ai:info'),
    aiConfigure:change=>ipcRenderer.invoke('ai:configure',change),
    aiChooseCli:()=>ipcRenderer.invoke('ai:choose-cli'),
    next:()=>ipcRenderer.invoke('books:next'),
    ready:()=>ipcRenderer.invoke('books:ready'),
    onOpen:callback=>{const listener=()=>callback();ipcRenderer.on('books:available',listener);return ()=>ipcRenderer.removeListener('books:available',listener);}
  });
}
