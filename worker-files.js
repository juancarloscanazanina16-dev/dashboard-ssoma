(function(){
'use strict';
const B='sst-worker-files',H=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const N=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const iso=v=>{const m=String(v).match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d{2})/);if(!m)return '';const d=new Date(Date.UTC(+m[3],+m[2]-1,+m[1]));return d.getUTCDate()===+m[1]&&d.getUTCMonth()===+m[2]-1&&d.getUTCFullYear()===+m[3]?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):''};
async function pdfText(file,onProgress){return (await window.ssomaReadPdf(file,onProgress)).text}
function extract(text,kind){
 const n=N(text);
 const brands=[['Sanitas Perú S.A. EPS',/SANITAS/,'SCTR_SALUD'],['Crecer Seguros S.A.',/CRECER SEGUROS/,'SCTR_PENSION'],['Rímac Seguros',/RIMAC/],['La Positiva',/LA POSITIVA/],['Pacífico Seguros',/PACIFICO/],['MAPFRE',/MAPFRE/],['Interseguro',/INTERSEGURO/],['Protecta',/PROTECTA/],['EsSalud',/ESSALUD/,'SCTR_SALUD']];
 const found=brands.filter(x=>x[1].test(n)&&(!x[2]||x[2]===kind)),preferred=found.filter(x=>x[2]===kind);
 let provider=kind.startsWith('SCTR_')?(preferred.length===1?preferred[0][0]:found.length===1?found[0][0]:''):'';
 if(kind==='EMO'){const match=text.match(/(?:CENTRO MEDICO|CLINICA|CLÍNICA|IPRESS|EMITIDO POR|ESTABLECIMIENTO)[ :\-]+([^\n]{4,90})/i);if(match)provider=match[1].trim()}
 const ranges=[];
 for(const line of text.split('\n').flatMap(x=>x.match(/(?:VIGENCIA|COBERTURA|PERIODO|PERÍODO|DESDE|HASTA|EMISION|EMISIÓN|VENCIMIENTO|CADUCIDAD|FECHA)[^\n]{0,180}/gi)||[])){
 const dates=[...line.matchAll(/\b\d{1,2}[\/.\-]\d{1,2}[\/.\-]20\d{2}\b/g)].map(x=>iso(x[0])).filter(Boolean);
 if(dates.length>=2&&dates[0]<=dates[1])ranges.push({from:dates[0],to:dates[1]});
 }
 ranges.sort((a,b)=>b.to.localeCompare(a.to));
 return {provider,from:ranges[0]?.from||'',to:ranges[0]?.to||'',scanned:text.replace(/\s/g,'').length<50};
}
window.attachWorkerDocumentFolders=function(modal,p,ctx){
 const {db,session,toast,check}=ctx;
 modal.querySelectorAll('[data-document-kind]').forEach(form=>{
  const kind=form.dataset.documentKind,container=document.createElement('div');container.style.cssText='border-top:1px solid #dbe5ef;margin-top:14px;padding-top:12px';
  const linked=kind==='SCTR_SALUD'||kind==='SCTR_PENSION';
  container.innerHTML='<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>📁 '+(linked?'SCTR vinculado a Expedientes':'Archivo del trabajador · '+H(kind))+'</b><span data-file-count class="muted"></span></div>'+(linked?'<p class="muted" style="font-size:12px;margin:8px 0">Pólizas de la contratista asignada. La cobertura individual solo se considera validada tras confirmar el DNI en la relación de asegurados. Los archivos individuales anteriores se conservan como históricos.</p>':'<label style="display:block;margin:10px 0">Adjuntar PDF<input type="file" accept=".pdf,application/pdf" data-worker-pdf></label><p class="muted" data-worker-note style="font-size:12px">Al seleccionar un PDF se intentará completar emisor y fechas. Revise antes de guardar.</p><button type="button" class="btn light small" data-worker-upload>Guardar PDF en carpeta</button>')+'<p class="muted" data-worker-note style="font-size:12px;display:'+(linked?'block':'none')+'"></p><div data-worker-list style="margin-top:10px"></div>';
  form.appendChild(container);
  const fileInput=container.querySelector('[data-worker-pdf]'),note=container.querySelector('[data-worker-note]'),button=container.querySelector('[data-worker-upload]'),list=container.querySelector('[data-worker-list]');
  async function refresh(){
   const res=await db.from('sst_worker_files').select('id,original_name,storage_path,uploaded_at,provider_name,issue_date,expiry_date').eq('person_id',p.id).eq('document_type',kind).order('uploaded_at',{ascending:false}).limit(100);
   if(res.error){note.textContent='No se pudieron consultar archivos: '+res.error.message;return}
   const individual=(res.data||[]).map(r=>({...r,bucket:B,source:'Individual'}));
   let company=[];
   if(kind.startsWith('SCTR_')&&p.contractor_id){
    const cr=await db.from('sst_contractor_files').select('id,original_name,storage_path,uploaded_at,coverage_start,coverage_end,insurer').eq('contractor_id',p.contractor_id).eq('category',kind).order('uploaded_at',{ascending:false}).limit(100);
    if(cr.error){note.textContent='No se pudo consultar el expediente empresarial: '+cr.error.message}
    else company=(cr.data||[]).map(r=>({...r,bucket:'sst-contractor-files',source:'Empresa · por verificar DNI'}));
   }
   const today=new Date().toISOString().slice(0,10);
   company.sort((a,b)=>Number(!!b.coverage_end&&b.coverage_start<=today&&b.coverage_end>=today)-Number(!!a.coverage_end&&a.coverage_start<=today&&a.coverage_end>=today)||(b.coverage_end||'').localeCompare(a.coverage_end||'')||(b.uploaded_at||'').localeCompare(a.uploaded_at||''));
   const files=linked?[...company,...individual]:individual;
   if(linked&&company.length){
    const eligible=company.filter(x=>x.coverage_start&&x.coverage_end);
    if(eligible.length){
     const policy=eligible[0];
     let verifyButton=container.querySelector('[data-verify-policy]');
     if(!verifyButton){
      verifyButton=document.createElement('button');verifyButton.type='button';verifyButton.className='btn light small';
      verifyButton.dataset.verifyPolicy='1';
      container.insertBefore(verifyButton,list);
     }
     verifyButton.textContent='🔎 Verificar DNI y completar fechas del SCTR';
     verifyButton.onclick=async()=>{
      verifyButton.disabled=true;
      try{
       note.textContent='Verificando DNI y nombres en la póliza empresarial...';
       const signed=await db.storage.from('sst-contractor-files').createSignedUrl(policy.storage_path,120);
       if(signed.error)throw signed.error;
       const response=await fetch(signed.data.signedUrl);
       if(!response.ok)throw Error('No se pudo leer la póliza empresarial');
       const result=await window.ssomaHighlightWorkerPdf(await response.blob(),p,message=>note.textContent=message);
       const currentIssue=form.elements.issue_date.value,currentExpiry=form.elements.expiry_date.value;
       if((currentIssue&&currentIssue!==policy.coverage_start)||(currentExpiry&&currentExpiry!==policy.coverage_end)){
        if(!window.confirm('Ya existen fechas individuales diferentes. ¿Deseas reemplazarlas con la cobertura verificada del SCTR empresarial?'))return;
       }
       form.elements.issue_date.value=policy.coverage_start;
       form.elements.expiry_date.value=policy.coverage_end;
       if(policy.insurer)form.elements.provider_name.value=policy.insurer;
       note.textContent='DNI y nombre coinciden en la página '+result.page+'. Fechas completadas desde la póliza. Pulsa Guardar '+(kind==='SCTR_SALUD'?'SCTR Salud':'SCTR Pensión')+' para registrar los cambios.';
       toast('Cobertura identificada. Confirma y guarda las fechas.');
      }catch(err){
       note.textContent='No se completaron las fechas: '+err.message+'. Revisa el PDF original y la relación de asegurados.';
       toast('No se pudo verificar el DNI automáticamente',true);
      }finally{verifyButton.disabled=false}
     };
    }
   }
   container.querySelector('[data-file-count]').textContent=linked?company.length+' póliza(s) empresarial(es) · '+individual.length+' histórico(s)':individual.length+' archivo(s)';
   list.innerHTML=(files.map((r,i)=>'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0;padding:9px;border:1px solid #dbe5ef;border-radius:10px"><span style="flex:1;min-width:150px"><b>'+H(r.original_name)+'</b><br><small>'+H(r.source)+' · '+H(new Date(r.uploaded_at).toLocaleDateString('es-PE'))+'</small></span><button type="button" class="btn light small" data-view-index="'+i+'">PDF original</button>'+(kind.startsWith('SCTR_')?'<button type="button" class="btn green small" data-highlight-index="'+i+'">🖍 Descargar PDF resaltado</button>':'')+(r.bucket===B?'<button type="button" class="btn light small" data-delete-index="'+i+'" style="color:#b42318;border:1px solid #f4b4ae" title="Eliminar únicamente este PDF individual">🗑 Eliminar</button>':'')+'</div>').join('')||'<p class="muted">'+(linked?'No hay pólizas SCTR en Expedientes de esta contratista. Cargue el SCTR desde Expedientes y valide a los trabajadores.':'Aún no existen PDF individuales. Adjunte uno para habilitar las descargas.')+'</p>');
   list.querySelectorAll('[data-delete-index]').forEach(b=>b.onclick=async()=>{
    const r=files[Number(b.dataset.deleteIndex)];
    if(!r||r.bucket!==B)return;
    if(!window.confirm('¿Eliminar definitivamente este PDF individual?\\n\\n'+r.original_name+'\\n\\nNo se eliminarán otros archivos, pólizas empresariales ni las fechas de vigencia registradas. Esta acción no se puede deshacer.'))return;
    b.disabled=true;
    try{
     const removed=await db.storage.from(B).remove([r.storage_path]);
     if(removed.error)throw removed.error;
     const deleted=await db.from('sst_worker_files').delete().eq('id',r.id).eq('person_id',p.id).eq('owner_id',session.user.id).select('id');
     if(deleted.error)throw deleted.error;
     if(!deleted.data?.length)throw Error('No se pudo eliminar el registro; actualice y compruebe los permisos');
     toast('PDF individual eliminado correctamente');
     await refresh();
    }catch(err){toast('No se pudo completar la eliminación: '+err.message,true);note.textContent='Error al eliminar: '+err.message}
    finally{b.disabled=false}
   });
   list.querySelectorAll('[data-view-index]').forEach(b=>b.onclick=async()=>{
    const r=files[Number(b.dataset.viewIndex)],url=await db.storage.from(r.bucket).createSignedUrl(r.storage_path,120);
    if(url.error)return toast(url.error.message,true);
    window.open(url.data.signedUrl,'_blank','noopener,noreferrer');
   });
   list.querySelectorAll('[data-highlight-index]').forEach(b=>b.onclick=async()=>{
    const r=files[Number(b.dataset.highlightIndex)];if(!r)return;
    b.disabled=true;
    try{
     note.textContent='Preparando descarga resaltada...';
     const signed=await db.storage.from(r.bucket).createSignedUrl(r.storage_path,120);
     if(signed.error)throw signed.error;
     const response=await fetch(signed.data.signedUrl);if(!response.ok)throw Error('No se pudo leer el PDF guardado');
     const result=await window.ssomaHighlightWorkerPdf(await response.blob(),p,msg=>note.textContent=msg);
     const url=URL.createObjectURL(result.blob),link=document.createElement('a');
     link.href=url;link.download='SCTR_'+kind.replace('SCTR_','')+'_'+String(p.dni||'trabajador')+'_RESALTADO.pdf';
     document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
     note.textContent='PDF resaltado generado: página '+result.page+'. Verifique visualmente la coincidencia.';
    }catch(err){note.textContent='No se generó el PDF resaltado: '+err.message;toast(err.message,true)}
    finally{b.disabled=false}
   });
  }
  if(!linked)fileInput.onchange=async()=>{
   const file=fileInput.files?.[0];if(!file)return;
   if(file.size>15*1024*1024)return note.textContent='Máximo 15 MB';
   note.textContent='Analizando documento...';
   try{
    const data=extract(await pdfText(file,message=>{note.textContent=message}),kind);
    if(data.from)form.elements.issue_date.value=data.from;
    if(data.to)form.elements.expiry_date.value=data.to;
    if(data.provider)form.elements.provider_name.value=data.provider;
    note.textContent=data.scanned?'El OCR no encontró texto suficiente. Revise el PDF y complete los datos manualmente.':!data.from||!data.to||!data.provider?'Extracción parcial. Revise o complete fechas y emisor antes de guardar.':'Campos sugeridos. Verifique las fechas y el emisor antes de guardar.';
   }catch(e){note.textContent='No se pudo analizar: '+e.message+'. Puede guardar el archivo y registrar los datos manualmente.'}
  };
  if(!linked)button.onclick=async()=>{
   const file=fileInput.files?.[0];if(!file)return toast('Seleccione un PDF',true);
   if(file.size>15*1024*1024||!(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')))return toast('Solo PDF de hasta 15 MB',true);
   if(!window.confirm('¿Guardar el PDF en la carpeta individual de este trabajador? Los campos sugeridos no se guardarán como vigencias hasta pulsar el botón Guardar del apartado.'))return;
   button.disabled=true;
   const path=[session.user.id,p.id,kind,crypto.randomUUID()+'.pdf'].join('/');
   try{
    const up=await db.storage.from(B).upload(path,file,{contentType:'application/pdf'});check(up.error);
    const record=await db.from('sst_worker_files').insert({owner_id:session.user.id,person_id:p.id,document_type:kind,storage_path:path,original_name:file.name,provider_name:form.elements.provider_name.value.trim()||null,issue_date:form.elements.issue_date.value||null,expiry_date:form.elements.expiry_date.value||null});
    if(record.error){await db.storage.from(B).remove([path]);throw record.error}
    toast('PDF guardado en carpeta individual');fileInput.value='';await refresh();
   }catch(e){toast('No se pudo guardar el PDF: '+e.message,true)}finally{button.disabled=false}
  };
  refresh();
 });
};
})();