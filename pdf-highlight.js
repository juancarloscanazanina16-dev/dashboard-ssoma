(function(){
'use strict';
const library='https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
let libReady;
function ensureLib(){if(!libReady)libReady=new Promise((resolve,reject)=>{if(window.PDFLib)return resolve();const s=document.createElement('script');s.src=library;s.onload=resolve;s.onerror=()=>reject(Error('No se pudo cargar el editor PDF'));document.head.appendChild(s)});return libReady}
function digits(s){return String(s||'').replace(/\D/g,'')}
function normalize(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim()}
function matchDni(text,dni){return new RegExp('(^|\\D)'+dni+'(?!\\d)').test(text)}
async function highlight(blob,person,onProgress){
 const dni=digits(person.dni);
 if(dni.length!==8)throw Error('El DNI del trabajador debe tener 8 dígitos');
 await ensureLib();
 if(!window.pdfjsLib)throw Error('No está disponible el lector PDF');
 const bytes=new Uint8Array(await blob.arrayBuffer());
 const src=await window.pdfjsLib.getDocument({data:bytes}).promise;
 const output=await window.PDFLib.PDFDocument.load(bytes,{ignoreEncryption:false});
 if(src.numPages!==output.getPageCount())throw Error('El número de páginas no coincide');
 const candidates=[];
 const fullName=normalize(person.full_name).split(' ').filter(w=>w.length>2);
 try{
 for(let n=1;n<=src.numPages;n++){
  onProgress?.('Buscando DNI en página '+n+' de '+src.numPages);
  const page=await src.getPage(n),viewport=page.getViewport({scale:1}),items=(await page.getTextContent()).items;
  const pieces=items.map(t=>({str:t.str||'',x:t.transform[4],y:t.transform[5],h:Math.max(7,Math.abs(t.height||t.transform[3]||9)),w:t.width||0}));
  const rows=[];
  for(const item of pieces){
   let row=rows.find(r=>Math.abs(r.y-item.y)<Math.max(5,item.h*.65));
   if(!row){row={y:item.y,items:[]};rows.push(row)}
   row.items.push(item);
  }
  for(const row of rows){
   row.items.sort((a,b)=>a.x-b.x);
   const text=row.items.map(i=>i.str).join(' ');
   if(!matchDni(text,dni))continue;
   const normalized=normalize(text);
   const nameHits=fullName.filter(w=>normalized.includes(w)).length;
   // Debe aparecer en una fila compatible con el nombre para evitar coincidencias incidentales.
   if(nameHits<Math.min(2,fullName.length))continue;
   const minX=Math.min(...row.items.map(i=>i.x)),maxX=Math.max(...row.items.map(i=>i.x+i.w));
   const height=Math.max(...row.items.map(i=>i.h));
   candidates.push({page:n-1,x:Math.max(0,minX-5),y:Math.max(0,row.y-height*.45-3),width:Math.min(viewport.width-minX+5,Math.max(100,maxX-minX+10)),height:height+8,method:'texto'});
  }
  // OCR cuando la página no tiene texto digital suficiente.
  if(pieces.map(x=>x.str).join('').replace(/\s/g,'').length<35){
   onProgress?.('Aplicando OCR a página '+n+' de '+src.numPages);
   if(!window.Tesseract){const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=reject;document.head.appendChild(script)})}
   const scale=1.8,vp=page.getViewport({scale}),canvas=document.createElement('canvas');canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);
   await page.render({canvasContext:canvas.getContext('2d'),viewport:vp}).promise;
   const worker=await window.Tesseract.createWorker('spa+eng');
   try{
    const result=await worker.recognize(canvas,{}, {blocks:true});
    const lines=result.data?.blocks?.flatMap(b=>b.paragraphs||[]).flatMap(p=>p.lines||[])||[];
    for(const line of lines){
     const text=line.text||line.words?.map(w=>w.text).join(' ')||'';
     if(!matchDni(text,dni))continue;
     const norm=normalize(text),hits=fullName.filter(w=>norm.includes(w)).length;
     if(hits<Math.min(2,fullName.length))continue;
     const bb=line.bbox;if(!bb)continue;
     candidates.push({page:n-1,x:bb.x0/scale-4,y:viewport.height-bb.y1/scale-4,width:(bb.x1-bb.x0)/scale+8,height:(bb.y1-bb.y0)/scale+8,method:'OCR'});
    }
   }finally{await worker.terminate();canvas.width=0;canvas.height=0}
  }
 }
 if(!candidates.length)throw Error('No se identificó una fila que coincida con el DNI y nombre. Descargue el PDF original y revise la relación de asegurados.');
 // Evitar marcar accidentalmente distintas personas o secciones repetidas.
 if(candidates.length!==1)throw Error('Se detectaron '+candidates.length+' posibles filas. Por seguridad no se resaltó ninguna; revise el PDF original.');
 const c=candidates[0],page=output.getPage(c.page),size=page.getSize();
 page.drawRectangle({x:Math.max(0,c.x),y:Math.max(0,c.y),width:Math.min(c.width,size.width-Math.max(0,c.x)),height:Math.min(c.height,size.height-Math.max(0,c.y)),color:window.PDFLib.rgb(1,.92,.12),opacity:.38});
 const data=await output.save();
 return {blob:new Blob([data],{type:'application/pdf'}),page:c.page+1,method:c.method};
 }finally{await src.destroy()}
}
window.ssomaHighlightWorkerPdf=highlight;
})();