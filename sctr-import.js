/* SCTR CONTROL: lectura local PDF + conciliación DNI + confirmación humana. */
(function(){
'use strict';
let results=[], currentContractor='';
const el=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
const dateISO=s=>{const m=String(s).match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](20\d{2})/);if(!m)return null;const d=new Date(Date.UTC(+m[3],+m[2]-1,+m[1]));return d.getUTCFullYear()===+m[3]&&d.getUTCMonth()===+m[2]-1&&d.getUTCDate()===+m[1]?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):null};
function insurer(text,kind){
 const x=norm(text);
 const candidates=[['Sanitas Perú S.A. EPS',/SANITAS/],['Crecer Seguros S.A.',/CRECER SEGUROS/],['RÍMAC SEGUROS',/\bRIMAC\b/],['PACÍFICO SEGUROS',/\bPACIFICO\b/],['MAPFRE',/\bMAPFRE\b/],['LA POSITIVA',/\bLA POSITIVA\b/],['INTERSEGURO',/\bINTERSEGURO\b/],['PROTECTA SECURITY',/\bPROTECTA\b/],['ONCOSALUD',/\bONCOSALUD\b/],['ESSALUD',/\bESSALUD\b/]];
 const found=candidates.filter(([,rx])=>rx.test(x)).map(([n])=>n);
 if(kind==='SCTR_SALUD'&&found.includes('Sanitas Perú S.A. EPS'))return ['Sanitas Perú S.A. EPS'];
 if(kind==='SCTR_PENSION'&&found.includes('Crecer Seguros S.A.'))return ['Crecer Seguros S.A.'];
 return found;
}
function dates(text){
 const patterns=[/(?:VIGENCIA|COBERTURA|PERIODO|PERÍODO)[^\n]{0,160}/gi,/(?:DESDE|INICIO|HASTA|FIN|VENCE|VENCIMIENTO)[^\n]{0,85}/gi];
 const lines=patterns.flatMap(rx=>[...text.matchAll(rx)].map(m=>m[0])).slice(0,35);
 const pairs=lines.map(line=>({line,ds:[...line.matchAll(/\b\d{1,2}[\/\-.]\d{1,2}[\/\-.]20\d{2}\b/g)].map(m=>dateISO(m[0])).filter(Boolean)}));
 const both=pairs.find(x=>x.ds.length>=2&&x.ds[0]<=x.ds[1]);
 if(both)return {from:both.ds[0],to:both.ds[1],source:both.line};
 const from=pairs.find(x=>/DESDE|INICIO/i.test(x.line)&&x.ds.length),to=pairs.find(x=>/HASTA|FIN|VENCE|VENCIMIENTO/i.test(x.line)&&x.ds.length);
 return {from:from?.ds[0]||'',to:to?.ds[0]||'',source:[from?.line,to?.line].filter(Boolean).join(' | ')};
}
async function pdfText(file){
 if(file.size>15*1024*1024)throw Error('El PDF supera 15 MB');
 if(!window.pdfjsLib){await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';script.onload=resolve;script.onerror=()=>reject(Error('No se pudo cargar el lector PDF'));document.head.appendChild(script)});}
 pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
 const doc=await pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
 if(doc.numPages>100)throw Error('PDF de más de 100 páginas: dividir en lotes');
 const pages=[];for(let i=1;i<=doc.numPages;i++){const p=await doc.getPage(i),content=await p.getTextContent();pages.push(content.items.map(x=>x.str).join(' '));}
 return pages.join('\n');
}
function candidatesFor(text,contractorId){
 const matches=[];for(const p of window.sctrContext.state.personnel.filter(x=>x.active&&x.contractor_id===contractorId)){
 const dni=String(p.dni||'').trim();
 if(/^\d{8}$/.test(dni)&&new RegExp('(^|\\D)'+dni+'(?!\\d)').test(text))matches.push(p);
 }return matches;
}
function render(){
 const host=el('sctrResults');if(!host)return;
 host.innerHTML=results.length?results.map((r,i)=>'<div class="card" style="padding:14px;margin:12px 0"><b>'+esc(r.file)+'</b> · '+esc(r.kind==='SCTR_SALUD'?'Salud':'Pensión')+'<p class="muted">Aseguradora detectada: <b>'+esc(r.insurers.join(', ')||'No identificada')+'</b> · DNI coincidentes: <b>'+r.matches.length+'</b> · Páginas con texto: '+r.textLength+'</p><div class="formgrid"><label>Aseguradora (confirmar)<input data-sctr-insurer="'+i+'" value="'+esc(r.insurers.length===1?r.insurers[0]:'')+'" placeholder="Nombre de aseguradora"></label><label>Inicio cobertura<input type="date" data-sctr-from="'+i+'" value="'+esc(r.from||'')+'"></label><label>Fin cobertura<input type="date" data-sctr-to="'+i+'" value="'+esc(r.to||'')+'"></label></div><p class="muted">DNI encontrados en la contrata seleccionada: '+esc(r.matches.map(p=>p.full_name+' ('+p.dni+')').join('; ')||'Ninguno')+'</p><p class="muted">Las fechas detectadas son sugerencias: verificar contra la póliza antes de confirmar.</p></div>').join('')+'<label style="display:flex;align-items:center;gap:8px;margin:12px 0"><input type="checkbox" id="sctrReviewed"> He revisado los PDF, la contratista, la aseguradora, los DNI y las fechas de cobertura.</label><button class="btn green" id="sctrConfirm">Confirmar y actualizar '+results.reduce((n,r)=>n+r.matches.length,0)+' coberturas</button>':'<p class="muted">Seleccione una contratista y adjunte uno o ambos PDF para analizar su contenido.</p>';
 el('sctrConfirm')?.addEventListener('click',save);
}
async function analyze(){
 const contractorId=el('sctrContractor').value, files=[['SCTR_SALUD',el('sctrHealth').files[0]],['SCTR_PENSION',el('sctrPension').files[0]]].filter(x=>x[1]);
 if(!contractorId||!files.length)return window.sctrContext.toast('Seleccione contratista y al menos un PDF',true);
 results=[];el('sctrResults').textContent='Analizando documentos...';el('sctrAnalyze').disabled=true;
 try{
 for(const [kind,file] of files){
 if(file.type!=='application/pdf'&&!file.name.toLowerCase().endsWith('.pdf'))throw Error('Solo se aceptan archivos PDF');
 const text=await pdfText(file);
 if(text.replace(/\s/g,'').length<50)throw Error(file.name+': PDF escaneado sin texto. Se necesita OCR para procesarlo.');
 const ins=insurer(text,kind),period=dates(text);
 results.push({kind,file:file.name,insurers:ins,from:period.from,to:period.to,matches:candidatesFor(text,contractorId),textLength:text.length});
 }
 currentContractor=contractorId;render();
 }catch(e){el('sctrResults').textContent='No se pudo analizar: '+e.message;window.sctrContext.toast(e.message,true)}finally{el('sctrAnalyze').disabled=false}
}
async function save(){
 if(!el('sctrReviewed')?.checked)return window.sctrContext.toast('Confirme la revisión documental antes de actualizar',true);
 if(el('sctrContractor').value!==currentContractor)return window.sctrContext.toast('Cambió la contratista: analice nuevamente los PDF',true);
 const payload=[];
 for(let i=0;i<results.length;i++){
 const r=results[i],ins=el('sctrResults').querySelector('[data-sctr-insurer="'+i+'"]').value.trim(),from=el('sctrResults').querySelector('[data-sctr-from="'+i+'"]').value,to=el('sctrResults').querySelector('[data-sctr-to="'+i+'"]').value;
 if(!ins||!from||!to||from>to)return window.sctrContext.toast('Complete aseguradora y fechas válidas de cada póliza',true);
 if(to<window.sctrContext.isoToday())return window.sctrContext.toast('No se puede registrar como vigente una cobertura vencida',true);
 for(const p of r.matches)payload.push({owner_id:window.sctrContext.session.user.id,person_id:p.id,document_type:r.kind,issue_date:from,expiry_date:to,provider_name:ins});
 }
 if(!results.length)return window.sctrContext.toast('No hay PDF analizados',true);
 const btn=el('sctrConfirm');btn.disabled=true;
 try{
  const archived=[],failures=[];
  // Primero guardar el original empresarial. Una falla de archivo no debe dejar coberturas actualizadas sin respaldo.
  for(let i=0;i<results.length;i++){
   const r=results[i],file=el(r.kind==='SCTR_SALUD'?'sctrHealth':'sctrPension').files[0];
   const ins=el('sctrResults').querySelector('[data-sctr-insurer="'+i+'"]').value.trim(),from=el('sctrResults').querySelector('[data-sctr-from="'+i+'"]').value,to=el('sctrResults').querySelector('[data-sctr-to="'+i+'"]').value;
   try{await window.archiveImportedSctr(currentContractor,r.kind,file,ins,from,to);archived.push(r.kind)}catch(err){failures.push(r.file+': '+err.message)}
  }
  if(failures.length)throw Error('No se completó el archivo empresarial: '+failures.join('; ')+'. Los PDF guardados se conservan en el expediente.');
  // Solo actualizar la ficha individual cuando la nueva cobertura no sea anterior a la registrada.
  const previous=window.sctrContext.state.documents||[];
  const applicable=payload.filter(p=>{const old=previous.find(d=>d.person_id===p.person_id&&d.document_type===p.document_type);return !old?.expiry_date||p.expiry_date>=old.expiry_date});
  const omitted=payload.length-applicable.length;
  if(applicable.length){const response=await window.sctrContext.db.from('sst_worker_documents').upsert(applicable,{onConflict:'person_id,document_type'});window.sctrContext.check(response.error);}
  window.sctrContext.toast('PDF empresariales archivados: '+archived.length+' · Coberturas individuales actualizadas: '+applicable.length+(omitted?' · Renovaciones anteriores omitidas: '+omitted:''));
  el('sctrImportModal')?.remove();await window.sctrContext.load();
 }catch(e){window.sctrContext.toast('Atención: '+e.message,true);btn.disabled=false}
}
window.openSctrImport=function(preselectedContractor='',preselectedKind=''){
 const modal=document.createElement('div');modal.id='sctrImportModal';modal.className='modal';modal.style.zIndex='9999';
 modal.innerHTML='<div class="modalbox" style="max-width:850px"><div class="modalhead"><h2>Validación masiva de SCTR</h2><button class="btn light" id="sctrClose">✕ Cerrar</button></div><div style="padding:18px;max-height:80vh;overflow:auto"><p class="muted">Los PDF se analizan en el navegador y, tras su confirmación, se guardan en la carpeta privada de la subcontratista. Seleccione la contratista y revise los resultados antes de actualizar vigencias.</p><div class="formgrid"><label>Contratista<select id="sctrContractor"><option value="">Seleccione</option>'+window.sctrContext.state.contractors.map(c=>'<option value="'+esc(c.id)+'" '+(c.id===preselectedContractor?'selected':'')+'>'+esc(c.name)+'</option>').join('')+'</select></label><label>SCTR Salud (PDF)<input id="sctrHealth" type="file" accept="application/pdf,.pdf"></label><label>SCTR Pensión (PDF)<input id="sctrPension" type="file" accept="application/pdf,.pdf"></label></div><button class="btn green" id="sctrAnalyze">Analizar PDF</button><div id="sctrResults"></div></div></div>';
 document.body.appendChild(modal);results=[];render();
 el('sctrClose').onclick=()=>modal.remove();modal.addEventListener('click',e=>{if(e.target===modal)modal.remove()});el('sctrAnalyze').onclick=analyze;
 if(preselectedKind==='SCTR_SALUD')el('sctrHealth').focus();else if(preselectedKind==='SCTR_PENSION')el('sctrPension').focus();
};
})();