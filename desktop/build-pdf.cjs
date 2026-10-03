const fs=require('node:fs/promises');
const path=require('node:path');
const esbuild=require('esbuild');
(async()=>{
 const target=path.join(__dirname,'../ebook-browser/vendor/pdf');await fs.mkdir(target,{recursive:true});
 const result=await esbuild.build({stdin:{contents:"import * as lib from 'pdfjs-dist/legacy/build/pdf.mjs';import * as worker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';globalThis.pdfjsWorker=worker;globalThis.pdfjsLib=lib;",resolveDir:__dirname},bundle:true,format:'esm',platform:'browser',write:false,minify:true,define:{'import.meta.url':'document.baseURI'}});
 await fs.writeFile(path.join(target,'pdf-bundle.js'),'window.PdfReady=(async()=>{'+result.outputFiles[0].text+'})();');
 const source=path.join(__dirname,'node_modules/pdfjs-dist');
 for(const name of ['cmaps','standard_fonts','wasm'])await fs.cp(path.join(source,name),path.join(target,name),{recursive:true});
 await fs.copyFile(path.join(source,'web/pdf_viewer.css'),path.join(target,'pdf_viewer.css'));
 await fs.copyFile(path.join(source,'LICENSE'),path.join(target,'LICENSE'));
 console.log('PDF runtime bundled');
})().catch(e=>{console.error(e);process.exitCode=1;});
