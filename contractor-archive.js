(function(){
'use strict';
const CATS=[['SCTR_SALUD','SCTR Salud'],['SCTR_PENSION','SCTR Pensión'],['FICHA_ATENCION_MEDICA','Ficha de atención médica · Gerencia General']];
const ctx=()=>window.sctrContext;
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
let contractorId='',records=[],selected=new Set(),deleting=false;

const norm=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
function isoDate(raw){
 const m=String(raw).match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](20\d{2})/);
 if(!m)return null;
 const d=new Date(Date.UTC(+m[3],+m[2]-1,+m[1]));
 return d.getUTCDate()===+m[1]&&d.getUTCMonth()===+m[2]-1&&d.getUTCFullYear()===+m[3]?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):null;
}
async function readPdf(file){
 if(!window.pdfjsLib)await new Promise((ok,fail)=>{const script=document.createElement('script');script.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';script.onload=ok;script.onerror=()=>fail(Error('No se pudo cargar el lector PDF'));document.head.appendChild(script)});
 window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
 const pdf=await window.pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
 if(pdf.numPages>100)throw Error('Documento de más de 100 páginas; divida el archivo');
 const pages=[];
 for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),content=await page.getTextContent();pages.push(content.items.map(x=>x.str).join(' '))}
 return pages.join('\n');
}
function extractPolicy(text,category){
 const x=norm(text);
 const entities=[['Sanitas Perú S.A. EPS',/\bSANITAS\b/,'SCTR_SALUD'],['Crecer Seguros S.A.',/\bCRECER SEGUROS\b/,'SCTR_PENSION'],['Rímac Seguros',/\bRIMAC\b/,null],['La Positiva',/\bLA POSITIVA\b/,null],['Pacífico Seguros',/\bPACIFICO\b/,null],['MAPFRE',/\bMAPFRE\b/,null],['Interseguro',/\bINTERSEGURO\b/,null],['Protecta Security',/\bPROTECTA\b/,null],['EsSalud',/\bESSALUD\b/,'SCTR_SALUD']];
 const matching=entities.filter(([name,rx,kind])=>rx.test(x)&&(!kind||kind===category));
 const preferred=matching.filter(v=>v[2]===category);
 const insurer=(preferred.length===1?preferred:matching.length===1?matching:[]).map(v=>v[0])[0]||'';
 // No escoger fechas aisladas: deben encontrarse juntas en un contexto de cobertura.
 const lines=text.split(/\n/).flatMap(v=>v.match(/(?:VIGENCIA|COBERTURA|PERIODO|PERÍODO|DESDE|HASTA|INICIO|FIN|VENCIMIENTO).{0,200}/gi)||[]);
 const ranges=[];
 for(const line of lines){
  const dates=[...line.matchAll(/\b\d{1,2}[\/.-]\d{1,2}[\/.-]20\d{2}\b/g)].map(m=>isoDate(m[0])).filter(Boolean);
  if(dates.length>=2&&dates[0]<=dates[1])ranges.push({from:dates[0],to:dates[1]});
 }
 ranges.sort((a,b)=>b.to.localeCompare(a.to)||b.from.localeCompare(a.from));
 return {insurer,from:ranges[0]?.from||'',to:ranges[0]?.to||'',ambiguous:matching.length>1&&!preferred.length,scanned:text.replace(/\s/g,'').length<50};
}
async function autoFill(e){
 const input=e.currentTarget,form=input.closest('form'),cat=form.dataset.archiveUpload,file=input.files?.[0];
 if(!file||cat==='FICHA_ATENCION_MEDICA')return;
 const note=form.querySelector('[data-pdf-note]');
 if(file.size>15*1024*1024){note.textContent='Archivo supera 15 MB';return}
 note.textContent='Analizando aseguradora y vigencia del PDF...';
 try{
  const data=extractPolicy(await readPdf(file),cat);
  form.elements.insurer.value=data.insurer;
  form.elements.coverage_start.value=data.from;
  form.elements.coverage_end.value=data.to;
  note.textContent=data.scanned?'PDF escaneado sin texto: complete los campos manualmente.':data.ambiguous?'Se detectaron varias aseguradoras: confirme la correspondiente a esta cobertura.':!data.insurer||!data.from||!data.to?'Extracción parcial: revise y complete los campos antes de guardar.':'Datos sugeridos automáticamente. Revise aseguradora y fechas antes de guardar.';
 }catch(err){note.textContent='No se pudo analizar el PDF: '+err.message+'. Complete los datos manualmente.'}
}

function nameOf(id){return ctx().state.contractors.find(c=>c.id===id)?.name||'Subcontratista'}
async function fetchFiles(){
 const q=await ctx().db.from('sst_contractor_files').select('*').eq('contractor_id',contractorId).order('uploaded_at',{ascending:false}).limit(500);
 if(q.error)throw q.error;records=q.data||[];selected.clear();
}
function view(){
 const root=document.getElementById('contractorArchive');if(!root)return;
 root.innerHTML='<div class="hero-v2"><div><h2>Expedientes documentales</h2><p>Documentos originales por subcontratista · almacenamiento privado</p></div></div><div class="card section"><h3>Seleccionar subcontratista</h3><select id="archiveContractor"><option value="">Seleccione una subcontratista</option>'+ctx().state.contractors.map(c=>'<option value="'+safe(c.id)+'" '+(c.id===contractorId?'selected':'')+'>'+safe(c.name)+'</option>').join('')+'</select></div>'+(contractorId?'<div class="card section"><h3>📁 '+safe(nameOf(contractorId))+'</h3><p class="muted">Los documentos son privados y solo se pueden consultar desde una sesión autorizada.</p>'+CATS.map(([key,label])=>'<div class="card" style="margin:14px 0;padding:16px"><div class="flex between" style="gap:8px;flex-wrap:wrap"><h3>📁 '+safe(label)+'</h3><span class="muted">'+records.filter(r=>r.category===key).length+' archivo(s)</span></div>'+(key==='FICHA_ATENCION_MEDICA'?'<form data-archive-upload="'+key+'" style="margin:10px 0"><div class="formgrid"><label>Ficha médica PDF<input name="file" type="file" accept="application/pdf,.pdf" required></label><label style="display:flex;align-items:center;gap:8px"><input type="checkbox" name="signed"> Firma de Gerencia General verificada por SSOMA</label></div><button class="btn green small" type="submit">↑ Guardar ficha en carpeta</button></form>':'<p class="muted">Archivo original de la empresa. Para incorporar nuevas pólizas, use una sola validación y conciliación con el personal asegurado.</p><button type="button" class="btn green small" data-archive-sctr="'+key+'">↑ Analizar y archivar SCTR</button>')+'<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap;margin:10px 0"><label style="font-size:12px"><input type="checkbox" data-archive-select-all="'+key+'"> Seleccionar todos</label><button type="button" class="btn red small" data-archive-delete-selected="'+key+'" disabled>Eliminar seleccionados (0)</button></div><div class="tablewrap"><table><thead><tr><th>Seleccionar</th><th>Archivo</th><th>Registro</th><th>Detalle</th><th>Acción</th></tr></thead><tbody>'+records.filter(r=>r.category===key).map(r=>'<tr><td><input type="checkbox" data-archive-select="'+safe(r.id)+'" '+(selected.has(r.id)?'checked':'')+' aria-label="Seleccionar documento"></td><td>'+safe(r.original_name)+'</td><td>'+safe(new Date(r.uploaded_at).toLocaleDateString('es-PE'))+'</td><td>'+safe(key==='FICHA_ATENCION_MEDICA'?(r.manager_signature_verified?'Firma verificada':'Firma pendiente de verificación'):[r.insurer,r.coverage_start,r.coverage_end].filter(Boolean).join(' · ')||'Sin metadatos')+'</td><td><button type="button" class="btn light small" data-archive-open="'+safe(r.id)+'">Ver / descargar</button></td></tr>').join('')+(records.some(r=>r.category===key)?'':'<tr><td colspan="5">Carpeta sin documentos</td></tr>')+'</tbody></table></div></div>').join('')+'</div>':'');
 root.querySelector('#archiveContractor').onchange=async e=>{contractorId=e.target.value;await reload()};
 root.querySelectorAll('[data-archive-upload]').forEach(f=>{f.onsubmit=upload});
 root.querySelectorAll('[data-archive-sctr]').forEach(b=>b.onclick=()=>window.openSctrImport(contractorId,b.dataset.archiveSctr));
 root.querySelectorAll('[data-archive-open]').forEach(b=>b.onclick=()=>openFile(b.dataset.archiveOpen));
 root.querySelectorAll('[data-archive-delete]').forEach(b=>b.onclick=()=>deleteFiles([b.dataset.archiveDelete]));
 root.querySelectorAll('[data-archive-select]').forEach(b=>b.onchange=()=>{if(b.checked)selected.add(b.dataset.archiveSelect);else selected.delete(b.dataset.archiveSelect);updateSelection(root)});
 root.querySelectorAll('[data-archive-select-all]').forEach(b=>b.onchange=()=>{records.filter(r=>r.category===b.dataset.archiveSelectAll).forEach(r=>{if(b.checked)selected.add(r.id);else selected.delete(r.id)});root.querySelectorAll('[data-archive-select]').forEach(c=>c.checked=selected.has(c.dataset.archiveSelect));updateSelection(root)});
 root.querySelectorAll('[data-archive-delete-selected]').forEach(b=>b.onclick=()=>deleteFiles(records.filter(r=>r.category===b.dataset.archiveDeleteSelected&&selected.has(r.id)).map(r=>r.id)));
 updateSelection(root);
}
function updateSelection(root){
 root.querySelectorAll('[data-archive-delete-selected]').forEach(b=>{const count=records.filter(r=>r.category===b.dataset.archiveDeleteSelected&&selected.has(r.id)).length;b.disabled=!count||deleting;b.textContent='Eliminar seleccionados ('+count+')'});
 root.querySelectorAll('[data-archive-select-all]').forEach(b=>{const ids=records.filter(r=>r.category===b.dataset.archiveSelectAll).map(r=>r.id),count=ids.filter(id=>selected.has(id)).length;b.checked=ids.length>0&&count===ids.length;b.indeterminate=count>0&&count<ids.length});
}
async function deleteFiles(ids){
 if(deleting||!ids.length)return;
 const target=records.filter(r=>ids.includes(r.id)&&r.contractor_id===contractorId);
 if(target.length!==ids.length)return ctx().toast('La selección cambió; actualice el expediente.',true);
 const kinds=[...new Set(target.map(r=>r.category))].map(k=>CATS.find(c=>c[0]===k)?.[1]||k).join(', ');
 if(!window.confirm('¿Eliminar definitivamente '+target.length+' PDF de '+nameOf(contractorId)+'?\nCarpetas: '+kinds+'\n\nSe borrarán los archivos y sus registros empresariales. Esta acción NO elimina ni recalcula automáticamente las vigencias individuales de los trabajadores. No se puede deshacer.'))return;
 deleting=true;updateSelection(document.getElementById('contractorArchive'));
 const failures=[];
 for(const file of target){
  try{
   // Borrar primero el objeto. Si falla, conservar el registro para permitir reintento.
   const removed=await ctx().db.storage.from('sst-contractor-files').remove([file.storage_path]);
   if(removed.error)throw removed.error;
   const deleted=await ctx().db.from('sst_contractor_files').delete().eq('id',file.id).eq('contractor_id',contractorId).select('id');
   if(deleted.error)throw deleted.error;
   if(!deleted.data?.length)throw Error('No se pudo confirmar la eliminación del registro');
   selected.delete(file.id);
  }catch(err){failures.push(file.original_name+': '+err.message)}
 }
 deleting=false;
 await reload();
 if(failures.length)ctx().toast('Algunos archivos no pudieron eliminarse: '+failures.join('; '),true);
 else ctx().toast('Se eliminaron '+target.length+' documento(s) del expediente empresarial');
}
async function reload(){try{records=[];if(contractorId)await fetchFiles();view()}catch(e){ctx().toast('No se pudo consultar expediente: '+e.message,true)}}
async function upload(e){
 e.preventDefault();const form=e.currentTarget,cat=form.dataset.archiveUpload,file=form.elements.file.files[0],btn=form.querySelector('button[type=submit]');
 if(!file||file.size>15*1024*1024||!(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')))return ctx().toast('Solo PDF de máximo 15 MB',true);
 const from=form.elements.coverage_start?.value||null,to=form.elements.coverage_end?.value||null;
 if(from&&to&&from>to)return ctx().toast('Periodo de cobertura incorrecto',true);
 btn.disabled=true;
 const path=[ctx().session.user.id,contractorId,cat,crypto.randomUUID()+'.pdf'].join('/');
 try{
 const up=await ctx().db.storage.from('sst-contractor-files').upload(path,file,{contentType:'application/pdf',upsert:false});if(up.error)throw up.error;
 const ins=await ctx().db.from('sst_contractor_files').insert({owner_id:ctx().session.user.id,contractor_id:contractorId,category:cat,storage_path:path,original_name:file.name,insurer:form.elements.insurer?.value?.trim()||null,coverage_start:from,coverage_end:to,manager_signature_verified:cat==='FICHA_ATENCION_MEDICA'&&!!form.elements.signed?.checked});
 if(ins.error){await ctx().db.storage.from('sst-contractor-files').remove([path]);throw ins.error}
 ctx().toast('PDF guardado en expediente de '+nameOf(contractorId));await reload();
 }catch(err){ctx().toast('No se pudo guardar PDF: '+err.message,true)}finally{btn.disabled=false}
}
async function openFile(id){
 const r=records.find(x=>x.id===id);if(!r)return;
 const result=await ctx().db.storage.from('sst-contractor-files').createSignedUrl(r.storage_path,120);
 if(result.error)return ctx().toast('No se pudo abrir el PDF: '+result.error.message,true);
 window.open(result.data.signedUrl,'_blank','noopener,noreferrer');
}
window.contractorArchivePage=function(){queueMicrotask(reload);return '<div id="contractorArchive"><p class="muted">Cargando expedientes...</p></div>'};
window.archiveImportedSctr=async function(contractor,kind,file,insurer,from,to){
 if(!file||!contractor)return;
 const path=[ctx().session.user.id,contractor,kind,crypto.randomUUID()+'.pdf'].join('/');
 const up=await ctx().db.storage.from('sst-contractor-files').upload(path,file,{contentType:'application/pdf',upsert:false});if(up.error)throw up.error;
 const ins=await ctx().db.from('sst_contractor_files').insert({owner_id:ctx().session.user.id,contractor_id:contractor,category:kind,storage_path:path,original_name:file.name,insurer,coverage_start:from,coverage_end:to});
 if(ins.error){await ctx().db.storage.from('sst-contractor-files').remove([path]);throw ins.error}
};
})();