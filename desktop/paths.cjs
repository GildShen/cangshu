const path = require('node:path');
function epubArguments(args,cwd=process.cwd()) {
  return args.filter(arg=>typeof arg==='string'&&!arg.startsWith('-')&&['.epub','.pdf'].includes(path.extname(arg).toLowerCase())).map(arg=>path.resolve(cwd,arg));
}
function assetPath(root,url) {
  const parsed=new URL(url);
  if(parsed.protocol!=='reader:'||parsed.host!=='app')throw new Error('Invalid application origin');
  const target=path.resolve(root,'.'+decodeURIComponent(parsed.pathname));
  const relative=path.relative(root,target);
  if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error('Invalid asset path');
  return target;
}
module.exports={epubArguments,assetPath};
