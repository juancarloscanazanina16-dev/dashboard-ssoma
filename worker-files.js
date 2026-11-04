(function(){
'use strict';
const B='sst-worker-files',H=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const N=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const iso=v=>{const m=String(v).match(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](20\d{2})/);if(!m)return '';const d=new Date(Date.UTC(+m[3],+m[2]-1,+m[1]));return d.getUTCDate()===+m[1]&&d.getUTCMonth()===+m[2]-1&&d.getUTCFullYear()===+m[3]?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):''};
async function pdfText(file){
 if(!window.pdfjsLib)await new Promise((ok,fail)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';s.onload=ok;s.onerror=()=>fail(Error('No se pudo iniciar lector PDF'));document.head.appendChild(s)});
 window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
 const doc=await window.pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
 if(doc.numPages>100)throw Error('PDF demasiado extenso (máximo 100 páginas)');
 const pages=[];for(let i=1;i<=doc.numPages;i++){const p=await doc.getPage(i),t=await p.getTextContent();pages.push(t.items.map(z=>z.str).join(' '))}
 return pages.join('\n');
}
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
  container.innerHTML='<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>📁 Archivo del trabajador · '+H(kind.replaceAll('_',' '))+'</b><span data-file-count class="muted"></span></div><label style="display:block;margin:10px 0">Adjuntar PDF<input type="file" accept=".pdf,application/pdf" data-worker-pdf></label><p class="muted" data-worker-note style="font-size:12px">Al seleccionar un PDF se intentará completar emisor y fechas. Revise antes de guardar.</p><button type="button" class="btn light small" data-worker-upload>Guardar PDF en carpeta</button><div data-worker-list style="margin-top:10px"></div>';
  form.appendChild(container);
  const fileInput=container.querySelector('[data-worker-pdf]'),note=container.querySelector('[data-worker-note]'),button=container.querySelector('[data-worker-upload]'),list=container.querySelector('[data-worker-list]');
  async function refresh(){
   const res=await db.from('sst_worker_files').select('id,original_name,storage_path,uploaded_at,provider_name,issue_date,expiry_date').eq('person_id',p.id).eq('document_type',kind).order('uploaded_at',{ascending:false}).limit(100);
   if(res.error){note.textContent='No se pudieron consultar archivos: '+res.error.message;return}
   container.querySelector('[data-file-count]').textContent=(res.data||[]).length+' PDF';
   list.innerHTML=(res.data||[]).map(r=>'<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0"><span style="flex:1;min-width:140px">'+H(r.original_name)+'</span><small>'+H(new Date(r.uploaded_at).toLocaleDateString('es-PE'))+'</small><button type="button" class="btn light small" data-view="'+H(r.id)+'">Ver / descargar</button></div>').join('')||'<span class="muted">Sin documentos guardados</span>';
   list.querySelectorAll('[data-view]').forEach(b=>b.onclick=async()=>{const r=res.data.find(x=>x.id===b.dataset.view),url=await db.storage.from(B).createSignedUrl(r.storage_path,120);if(url.error)return toast(url.error.message,true);window.open(url.data.signedUrl,'_blank','noopener,noreferrer')});
  }
  fileInput.onchange=async()=>{
   const file=fileInput.files?.[0];if(!file)return;
   if(file.size>15*1024*1024)return note.textContent='Máximo 15 MB';
   note.textContent='Analizando documento...';
   try{
    const data=extract(await pdfText(file),kind);
    if(data.from)form.elements.issue_date.value=data.from;
    if(data.to)form.elements.expiry_date.value=data.to;
    if(data.provider)form.elements.provider_name.value=data.provider;
    note.textContent=data.scanned?'PDF escaneado: requiere OCR. Complete datos manualmente.':!data.from||!data.to||!data.provider?'Extracción parcial. Revise o complete fechas y emisor antes de guardar.':'Campos sugeridos. Verifique las fechas y el emisor antes de guardar.';
   }catch(e){note.textContent='No se pudo analizar: '+e.message+'. Puede guardar el archivo y registrar los datos manualmente.'}
  };
  button.onclick=async()=>{
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