/* OCR local para PDF escaneados. PDF.js + Tesseract.js, sin enviar PDFs a servidor OCR. */
(function(){
'use strict';
let pdfPromise=null,ocrPromise=null,workerPromise=null;
function script(url){return new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=url;el.onload=resolve;el.onerror=()=>reject(Error('No se pudo cargar librería de lectura OCR'));document.head.appendChild(el)})}
async function pdfLib(){
 if(!pdfPromise)pdfPromise=(async()=>{if(!window.pdfjsLib)await script('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';return window.pdfjsLib})();
 return pdfPromise;
}
async function ocrWorker(){
 if(!workerPromise)workerPromise=(async()=>{
  if(!ocrPromise)ocrPromise=window.Tesseract?Promise.resolve():script('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
  await ocrPromise;
  return window.Tesseract.createWorker('spa+eng',1,{logger:()=>{}});
 })();
 return workerPromise;
}
async function read(file,onProgress){
 if(!file||file.size>15*1024*1024)throw Error('El archivo supera 15 MB');
 const lib=await pdfLib(),doc=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
 if(doc.numPages>100)throw Error('Máximo 100 páginas por archivo; divida el PDF');
 const parts=[],ocrPages=[];
 try{
  for(let i=1;i<=doc.numPages;i++){
   const page=await doc.getPage(i),items=(await page.getTextContent()).items;
   const text=items.map(x=>x.str).join(' ').trim();
   // OCR por página solo cuando el texto embebido es escaso.
   if(text.replace(/\s/g,'').length>=35){parts.push(text);continue}
   if(onProgress)onProgress('OCR página '+i+' de '+doc.numPages+' (puede tardar)...');
   const viewport=page.getViewport({scale:1.8}),canvas=document.createElement('canvas');
   canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
   const context=canvas.getContext('2d',{willReadFrequently:true});
   if(!context)throw Error('El navegador no permite procesar la imagen');
   await page.render({canvasContext:context,viewport}).promise;
   const worker=await ocrWorker();
   const recognized=await worker.recognize(canvas);
   parts.push(recognized.data.text||'');
   ocrPages.push(i);
   canvas.width=0;canvas.height=0;
  }
  if(onProgress)onProgress(ocrPages.length?'OCR completado en '+ocrPages.length+' página(s). Revise los datos extraídos.':'Texto del PDF leído. Revise los datos extraídos.');
  return {text:parts.join('\n'),ocrPages,totalPages:doc.numPages};
 }finally{await doc.destroy()}
}
window.ssomaReadPdf=read;
})();