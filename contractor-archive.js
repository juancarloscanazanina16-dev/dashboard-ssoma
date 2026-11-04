(function(){
'use strict';
const CATS=[['SCTR_SALUD','SCTR Salud'],['SCTR_PENSION','SCTR Pensión'],['FICHA_ATENCION_MEDICA','Ficha de atención médica · Gerencia General']];
const ctx=()=>window.sctrContext;
const safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
let contractorId='',records=[];
function nameOf(id){return ctx().state.contractors.find(c=>c.id===id)?.name||'Subcontratista'}
async function fetchFiles(){
 const q=await ctx().db.from('sst_contractor_files').select('*').eq('contractor_id',contractorId).order('uploaded_at',{ascending:false}).limit(500);
 if(q.error)throw q.error;records=q.data||[];
}
function view(){
 const root=document.getElementById('contractorArchive');if(!root)return;
 root.innerHTML='<div class="hero-v2"><div><h2>Expedientes documentales</h2><p>Documentos originales por subcontratista · almacenamiento privado</p></div></div><div class="card section"><h3>Seleccionar subcontratista</h3><select id="archiveContractor"><option value="">Seleccione una subcontratista</option>'+ctx().state.contractors.map(c=>'<option value="'+safe(c.id)+'" '+(c.id===contractorId?'selected':'')+'>'+safe(c.name)+'</option>').join('')+'</select></div>'+(contractorId?'<div class="card section"><h3>📁 '+safe(nameOf(contractorId))+'</h3><p class="muted">Los documentos son privados y solo se pueden consultar desde una sesión autorizada.</p>'+CATS.map(([key,label])=>'<div class="card" style="margin:14px 0;padding:16px"><div class="flex between" style="gap:8px;flex-wrap:wrap"><h3>📁 '+safe(label)+'</h3><span class="muted">'+records.filter(r=>r.category===key).length+' archivo(s)</span></div><form data-archive-upload="'+key+'" style="margin:10px 0"><div class="formgrid"><label>Archivo PDF<input name="file" type="file" accept="application/pdf,.pdf" required></label>'+(key!=='FICHA_ATENCION_MEDICA'?'<label>Aseguradora / EPS<input name="insurer" maxlength="120" placeholder="Opcional"></label><label>Inicio de cobertura<input type="date" name="coverage_start"></label><label>Fin de cobertura<input type="date" name="coverage_end"></label>':'<label style="display:flex;align-items:center;gap:8px"><input type="checkbox" name="signed"> Firma de Gerencia General verificada por SSOMA</label>')+'</div><button class="btn green small" type="submit">↑ Guardar PDF en carpeta</button></form><div class="tablewrap"><table><thead><tr><th>Archivo</th><th>Registro</th><th>Detalle</th><th>Acción</th></tr></thead><tbody>'+records.filter(r=>r.category===key).map(r=>'<tr><td>'+safe(r.original_name)+'</td><td>'+safe(new Date(r.uploaded_at).toLocaleDateString('es-PE'))+'</td><td>'+safe(key==='FICHA_ATENCION_MEDICA'?(r.manager_signature_verified?'Firma verificada':'Firma pendiente de verificación'):[r.insurer,r.coverage_start,r.coverage_end].filter(Boolean).join(' · ')||'Sin metadatos')+'</td><td><button type="button" class="btn light small" data-archive-open="'+safe(r.id)+'">Ver / descargar</button></td></tr>').join('')+(records.some(r=>r.category===key)?'':'<tr><td colspan="4">Carpeta sin documentos</td></tr>')+'</tbody></table></div></div>').join('')+'</div>':'');
 root.querySelector('#archiveContractor').onchange=async e=>{contractorId=e.target.value;await reload()};
 root.querySelectorAll('[data-archive-upload]').forEach(f=>f.onsubmit=upload);
 root.querySelectorAll('[data-archive-open]').forEach(b=>b.onclick=()=>openFile(b.dataset.archiveOpen));
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