const fs=require('node:fs/promises');
const sharp=require('sharp');
(async()=>{
  const png=await sharp('../ebook-browser/favicon.svg').resize(256,256).png().toBuffer();
  await fs.writeFile('icon.png',png);
  const header=Buffer.alloc(22);header.writeUInt16LE(1,2);header.writeUInt16LE(1,4);header.writeUInt16LE(1,10);header.writeUInt16LE(32,12);header.writeUInt32LE(png.length,14);header.writeUInt32LE(22,18);
  await fs.writeFile('icon.ico',Buffer.concat([header,png]));
})().catch(error=>{console.error(error);process.exitCode=1;});
