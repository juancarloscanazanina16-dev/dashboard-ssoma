/* Lista Maestra Documental SGSST / SGA */
(function(){
'use strict';
const BUCKET='ssoma-master-docs', TABLE='ssoma_master_documents';
const MIME={pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',xls:'application/vnd.ms-excel',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
const extension=name=>(String(name).split('.').pop()||'').toLowerCase();
const TYPES={SGSST:{ATS:'ATS',PETAR:'PETAR',PETS:'PETS',CHK:'Checklists',IPERC:'IPERC',INS:'Inspecciones SST',REG:'Registros',OTR:'Otros SST'},SGA:{INS:'Inspecciones ambientales',RES:'Residuos',MON:'Monitoreos',DER:'Control de derrames',CHK:'Checklists ambientales',PETS:'Procedimientos',REG:'Registros',OTR:'Otros ambientales'}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const parse=name=>{
 const m=/^(SGSST|SGA)-([A-Z0-9]{2,12})-(\d{3,})_(.+)_V(\d{2,3})\.(pdf|doc|docx|xls|xlsx)$/i.exec(name.trim());
 if(!m)return null;
 const system=m[1].toUpperCase(),type=m[2].toUpperCase(),version=Number(m[5]);
 if(!TYPES[system][type]||!version||version>999)return null;
 return {system_code:system,document_type:type,document_code:system+'-'+type+'-'+m[3],document_name:m[4].replace(/[_\s]+/g,' ').trim(),version_number:version,original_filename:name};
};
let ctx=null,docs=[],system='TODOS',query='',statusFilter='TODOS',busy=false;
const root=()=>document.getElementById('masterDocumentsRoot');
const msg=(s,bad=false)=>ctx?.toast?.(s,bad);
function page(c){ctx=c;system=c.initialSystem||'TODOS';query='';statusFilter='TODOS';docs=[];setTimeout(refresh,0);return `<section id="masterDocumentsRoot" class="md-root">
<div class="md-hero"><div><span class="md-eyebrow">SSOMA CONTROL 2.0 · Gestión integrada</span><h2>Lista Maestra Documental</h2><p>Biblioteca central SGSST y SGA · Codificación y versiones automáticas</p></div><div class="md-hero-icon">▤</div></div>
<div class="md-grid md-kpi-grid"><button type="button" class="md-tile md-kpi" data-md-status-filter="TODOS"><strong id="md-total">—</strong><span>Total de versiones</span></button><button type="button" class="md-tile md-kpi md-kpi-green" data-md-status-filter="VIGENTE"><strong id="md-vigente">—</strong><span>● Vigentes</span></button><button type="button" class="md-tile md-kpi md-kpi-yellow" data-md-status-filter="PENDIENTE"><strong id="md-pending">—</strong><span>● En revisión</span></button><button type="button" class="md-tile md-kpi md-kpi-red" data-md-status-filter="OBSOLETO"><strong id="md-obsoleto">—</strong><span>● Obsoletos</span></button></div>
<div class="card md-panel"><div class="md-panel-title"><div><h3>Importar documentos Word, PDF y Excel</h3><p class="muted">El nombre codificado genera automáticamente el registro. PDF, DOC, DOCX, XLS y XLSX · Hasta 20 MB por archivo.</p></div></div>
<div class="md-upload-controls"><label>Sistema documental<select id="md-upload-system"><option value="SGSST">SGSST · Seguridad y Salud</option><option value="SGA">SGA · Gestión Ambiental</option></select></label><label class="md-filelabel">Seleccionar archivos<input id="md-file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" multiple></label><button type="button" id="md-upload" class="btn green">↑ Subir y registrar</button></div>
<div id="md-preview" class="md-preview muted">Ejemplo: SGSST-ATS-001_Analisis_de_trabajo_seguro_V01.pdf</div><p class="muted">Los documentos cargados quedan PENDIENTES hasta su revisión y aprobación. No se publican automáticamente como vigentes.</p></div>
<div class="card md-panel"><div class="md-panel-title"><div><h3>Biblioteca y Lista Maestra</h3><p class="muted">Búsqueda por código, nombre, tipo, sistema o versión</p></div><button id="md-refresh" class="btn light small">↻ Actualizar</button></div>
<div class="md-toolbar"><input id="md-search" placeholder="Buscar: SGSST-ATS-001, inspección, V02..." aria-label="Buscar documentos"><select id="md-system"><option value="TODOS">Todos los sistemas</option><option value="SGSST">SGSST</option><option value="SGA">SGA</option></select><select id="md-type"><option value="TODOS">Todas las carpetas</option></select><select id="md-status-filter" aria-label="Filtrar por estado"><option value="TODOS">Todos los estados</option><option value="VIGENTE">Vigentes</option><option value="PENDIENTE">En revisión</option><option value="OBSOLETO">Obsoletos</option></select></div>
<div class="md-export-actions"><span class="muted">Exportar Lista Maestra filtrada:</span><button type="button" class="btn light small" data-md-export="excel">Excel</button><button type="button" class="btn light small" data-md-export="word">Word</button><button type="button" class="btn light small" data-md-export="pdf">PDF</button><button type="button" class="btn light small" data-md-export="print">Imprimir / Excel a imprimir</button></div><div id="md-folders" class="md-folders"></div><div class="tablewrap"><table class="md-table"><thead><tr><th>Sistema / Carpeta</th><th>Código</th><th>Documento</th><th>Versión</th><th>Estado</th><th>Carga</th><th>Formato</th><th>Acciones del archivo</th><th>Gestión</th></tr></thead><tbody id="md-rows"><tr><td colspan="9">Cargando documentos...</td></tr></tbody></table></div><p class="muted md-note">Cada versión se conserva como registro independiente. El historial no se sobrescribe.</p></div></section>`;}
function folders(){
 const e=document.getElementById('md-folders'),t=document.getElementById('md-type');if(!e||!t)return;
 const systems=system==='TODOS'?['SGSST','SGA']:[system];
 const entries=systems.flatMap(s=>Object.entries(TYPES[s]).map(([code,label])=>({s,code,label})));
 const previous=t.value;t.innerHTML='<option value="TODOS">Todas las carpetas</option>'+entries.map(x=>`<option value="${x.s}:${x.code}">${esc(x.s+' · '+x.label)}</option>`).join('');t.value=[...t.options].some(x=>x.value===previous)?previous:'TODOS';
 e.innerHTML=entries.map(x=>`<button type="button" class="md-folder" data-md-folder="${x.s}:${x.code}"><span class="md-folder-icon">${x.s==='SGA'?'♧':'▣'}</span><span><b>${esc(x.label)}</b><small>${x.s} · ${docs.filter(d=>d.system_code===x.s&&d.document_type===x.code).length} archivos</small></span></button>`).join('');
}
function draw(){
 if(!root())return;
 const n=id=>document.getElementById(id);
 n('md-total').textContent=docs.length;n('md-vigente').textContent=docs.filter(d=>d.status==='VIGENTE').length;n('md-obsoleto').textContent=docs.filter(d=>d.status==='OBSOLETO').length;n('md-pending').textContent=docs.filter(d=>d.status==='PENDIENTE').length;n('md-status-filter').value=statusFilter;document.querySelectorAll('[data-md-status-filter]').forEach(b=>b.classList.toggle('selected',b.dataset.mdStatusFilter===statusFilter));
 folders();
 const type=n('md-type').value;
 const rows=filteredDocs();
 n('md-rows').innerHTML=rows.length?rows.map(d=>`<tr><td><span class="md-system ${d.system_code==='SGA'?'env':''}">${esc(d.system_code)}</span><br><small>${esc(TYPES[d.system_code]?.[d.document_type]||d.document_type)}</small></td><td><b>${esc(d.document_code)}</b></td><td>${esc(d.document_name)}</td><td>V${String(d.version_number).padStart(2,'0')}</td><td><select class="md-status-select md-status-${d.status==='VIGENTE'?'green':d.status==='OBSOLETO'?'red':'yellow'}" data-md-status="${esc(d.id)}" aria-label="Estado de ${esc(d.document_code)}"><option value="PENDIENTE" ${d.status==='PENDIENTE'?'selected':''}>En revisión</option><option value="VIGENTE" ${d.status==='VIGENTE'?'selected':''}>Válido / Vigente</option><option value="OBSOLETO" ${d.status==='OBSOLETO'?'selected':''}>Obsoleto</option></select></td><td>${new Date(d.uploaded_at).toLocaleDateString('es-PE')}</td><td><span class="md-ext">${esc(extension(d.original_filename).toUpperCase())}</span></td><td><div class="md-file-actions"><button type="button" class="btn light small" data-md-open="${esc(d.id)}">Ver</button><button type="button" class="btn light small" data-md-download="${esc(d.id)}">↓ Descargar</button><button type="button" class="btn light small" data-md-print="${esc(d.id)}">▤ Imprimir</button></div></td><td><button type="button" class="btn red small" data-md-delete="${esc(d.id)}" aria-label="Eliminar ${esc(d.document_code)} versión ${d.version_number}">Eliminar</button></td></tr>`).join(''):'<tr><td colspan="9" class="muted">No se encontraron documentos.</td></tr>';
}
function filteredDocs(){
 const type=document.getElementById('md-type')?.value||'TODOS';
 return docs.filter(d=>(system==='TODOS'||d.system_code===system)&&(type==='TODOS'||type===d.system_code+':'+d.document_type)&&(statusFilter==='TODOS'||d.status===statusFilter)&&[d.document_code,d.document_name,d.document_type,d.system_code,d.original_filename,'V'+String(d.version_number).padStart(2,'0')].join(' ').toLowerCase().includes(query.toLowerCase()));
}
async function refresh(){
 if(!ctx||!root())return;
 const r=await ctx.db.from(TABLE).select('*').order('uploaded_at',{ascending:false}).limit(5000);
 if(r.error){msg('No se pudo consultar la Lista Maestra: '+r.error.message,true);document.getElementById('md-rows').innerHTML='<tr><td colspan="9">Error al cargar. Verifica tu conexión.</td></tr>';return;}
 docs=r.data||[];draw();
}
function preview(){
 const f=Array.from(document.getElementById('md-file')?.files||[]);
 const e=document.getElementById('md-preview');if(!e)return;
 e.innerHTML=f.length?f.map(file=>{const p=parse(file.name);return `<div class="${p?'md-valid':'md-invalid'}">${esc(file.name)} — ${p?esc(p.document_code+' · '+p.document_name+' · V'+String(p.version_number).padStart(2,'0')):'Nombre no válido'}</div>`;}).join(''):'Ejemplo: SGSST-ATS-001_Analisis_de_trabajo_seguro_V01.pdf';
}
async function upload(){
 if(busy||!ctx)return;
 const input=document.getElementById('md-file'),files=Array.from(input.files||[]),sel=document.getElementById('md-upload-system').value;
 if(!files.length)return msg('Selecciona uno o varios documentos PDF.',true);
 const items=files.map(f=>({f,p:parse(f.name)}));
 if(items.some(x=>!x.p||x.p.system_code!==sel||x.f.size>20971520||x.f.size===0||!MIME[extension(x.f.name)]))return msg('Revisa código, sistema, tipo, versión y tamaño (máx. 20 MB).',true);
 if(new Set(items.map(x=>x.p.document_code+':'+x.p.version_number)).size!==items.length)return msg('La selección contiene códigos y versiones repetidos.',true);
 busy=true;const button=document.getElementById('md-upload');button.disabled=true;button.textContent='Subiendo...';
 let ok=0,fail=[];
 try{
  const u=await ctx.db.auth.getUser();if(u.error||!u.data.user)throw Error('Sesión no válida');
  for(const {f,p} of items){
   const exists=await ctx.db.from(TABLE).select('id').eq('document_code',p.document_code).eq('version_number',p.version_number).maybeSingle();
   if(exists.error){fail.push(f.name+': '+exists.error.message);continue;}
   if(exists.data){fail.push(f.name+': versión ya registrada');continue;}
   const path=[u.data.user.id,p.system_code,p.document_type,p.document_code,'V'+String(p.version_number).padStart(2,'0'),crypto.randomUUID()+'.'+extension(f.name)].join('/');
   const put=await ctx.db.storage.from(BUCKET).upload(path,f,{contentType:MIME[extension(f.name)],upsert:false});
   if(put.error){fail.push(f.name+': '+put.error.message);continue;}
   const saved=await ctx.db.from(TABLE).insert({...p,owner_id:u.data.user.id,storage_path:path,status:'PENDIENTE'});
   if(saved.error){await ctx.db.storage.from(BUCKET).remove([path]);fail.push(f.name+': '+saved.error.message);continue;}
   ok++;
  }
  if(ok){input.value='';preview();await refresh();}
  msg(ok+' documento(s) registrados.'+(fail.length?' Errores: '+fail.join(' | '):''),!!fail.length);
 }catch(e){msg('Error de carga: '+e.message,true);}
 finally{busy=false;if(button){button.disabled=false;button.textContent='↑ Subir y registrar';}}
}
async function setStatus(id,newStatus){
 if(busy||!ctx)return;
 const d=docs.find(x=>x.id===id);if(!d||!['PENDIENTE','VIGENTE','OBSOLETO'].includes(newStatus))return;
 if(d.status===newStatus)return;
 if(newStatus==='VIGENTE'){
  const current=docs.find(x=>x.id!==id&&x.document_code===d.document_code&&x.status==='VIGENTE');
  if(!window.confirm('¿Confirmas que revisaste y validaste '+d.document_code+' V'+String(d.version_number).padStart(2,'0')+'?'+(current?' La versión '+String(current.version_number).padStart(2,'0')+' pasará automáticamente a OBSOLETO.':'')+' Esta acción cambia su estado a VIGENTE.')){draw();return;}
 }
 busy=true;
 try{
  const r=await ctx.db.rpc('ssoma_set_document_status',{p_document_id:id,p_status:newStatus});
  if(r.error)throw r.error;
  await refresh();msg('Estado actualizado: '+d.document_code+' → '+(newStatus==='PENDIENTE'?'En revisión':newStatus==='VIGENTE'?'Válido / Vigente':'Obsoleto'));
 }catch(e){msg('No se pudo actualizar el estado: '+e.message,true);draw();}
 finally{busy=false;}
}
async function deleteDocument(id){
 if(busy||!ctx)return;
 const d=docs.find(x=>x.id===id);if(!d)return;
 if(!window.confirm('¿Eliminar definitivamente '+d.document_code+' V'+String(d.version_number).padStart(2,'0')+'? Se borrará este registro y su PDF. Esta acción no se puede deshacer.'))return;
 busy=true;
 try{
  const r=await ctx.db.from(TABLE).delete().eq('id',id).select('id').single();
  if(r.error)throw r.error;
  const f=await ctx.db.storage.from(BUCKET).remove([d.storage_path]);
  await refresh();
  if(f.error)msg('Registro eliminado, pero no se pudo borrar el PDF del almacenamiento: '+f.error.message,true);
  else msg('Documento eliminado: '+d.document_code+' V'+String(d.version_number).padStart(2,'0'));
 }catch(e){msg('No se pudo eliminar el documento: '+e.message,true);}
 finally{busy=false;}
}
function exportRows(){
 return filteredDocs().map(d=>[d.system_code,d.document_code,d.document_name,'V'+String(d.version_number).padStart(2,'0'),d.status==='PENDIENTE'?'En revisión':d.status==='VIGENTE'?'Vigente':'Obsoleto',d.document_type,extension(d.original_filename).toUpperCase(),new Date(d.uploaded_at).toLocaleDateString('es-PE')]);
}
const HEADERS=['Sistema','Código','Documento','Versión','Estado','Tipo','Formato','Fecha de carga'];
function saveBlob(content,type,filename){
 const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function reportHtml(rows){
 const body=[HEADERS,...rows].map((cells,i)=>'<tr>'+cells.map(v=>'<'+(i?'td':'th')+'>'+esc(v)+'</'+(i?'td':'th')+'>').join('')+'</tr>').join('');
 return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Lista Maestra SSOMA</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#19314b}h1{color:#12395c;font-size:21px}p{color:#52677b;font-size:12px}table{border-collapse:collapse;width:100%;font-size:11px}th{background:#163e61;color:white;text-align:left}th,td{border:1px solid #c8d7e2;padding:7px}tr:nth-child(even){background:#f0f6fa}@page{size:A4 landscape;margin:12mm}</style></head><body><h1>LISTA MAESTRA DOCUMENTAL SSOMA</h1><p>SGSST / SGA · Generado: '+new Date().toLocaleString('es-PE')+' · Registros: '+rows.length+'</p><table>'+body+'</table></body></html>';
}
function printReport(rows){
 const w=window.open('','_blank');if(!w){msg('Habilita las ventanas emergentes para imprimir o guardar en PDF.',true);return;}
 w.document.open();w.document.write(reportHtml(rows));w.document.close();w.focus();setTimeout(()=>w.print(),350);
}
async function exportMaster(kind){
 const rows=exportRows();if(!rows.length)return msg('No hay documentos para exportar con los filtros actuales.',true);
 const name='Lista_Maestra_SSOMA_'+new Date().toISOString().slice(0,10);
 if(kind==='print'){printReport(rows);return;}
 if(kind==='word'){
  saveBlob('\ufeff'+reportHtml(rows),'application/msword',name+'.doc');msg('Lista Maestra exportada en Word (.doc).');return;
 }
 if(kind==='excel'){
  const xml=s=>esc(s);
  const data=[HEADERS,...rows].map(cells=>'<Row>'+cells.map(v=>'<Cell><Data ss:Type="String">'+xml(v)+'</Data></Cell>').join('')+'</Row>').join('');
  const sheet='<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Lista Maestra"><Table>'+data+'</Table></Worksheet></Workbook>';
  saveBlob('\ufeff'+sheet,'application/vnd.ms-excel',name+'.xls');msg('Lista Maestra exportada en Excel (.xls).');return;
 }
 if(kind==='pdf'){
  // El diálogo de impresión del navegador permite guardar como PDF sin exponer documentos privados.
  printReport(rows);msg('Selecciona "Guardar como PDF" en la ventana de impresión.');return;
 }
}
async function openFile(id,mode='view'){
 const d=docs.find(x=>x.id===id);if(!d||!ctx)return;
 const ext=extension(d.original_filename);
 if(mode==='print'&&ext!=='pdf'){
  msg('Para imprimir Word o Excel, descarga el archivo y utiliza Imprimir en Word o Excel para conservar su formato.');
  return;
 }
 const tab=mode==='download'?null:window.open('','_blank');
 if(tab){tab.document.title='Preparando documento';tab.document.body.textContent='Preparando archivo seguro...';}
 try{
  if(mode==='print'){
   // Descargar como Blob evita restricciones de impresión de un PDF en otro origen.
   const result=await ctx.db.storage.from(BUCKET).download(d.storage_path);
   if(result.error)throw result.error;
   if(!tab){msg('Habilita las ventanas emergentes para imprimir.',true);return;}
   const url=URL.createObjectURL(new Blob([result.data],{type:'application/pdf'}));
   tab.document.open();
   tab.document.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Imprimir documento</title><style>html,body{height:100%;margin:0}iframe{width:100%;height:100%;border:0}</style></head><body><iframe id="pdfprint" title="Documento para imprimir"></iframe></body></html>');
   tab.document.close();
   const frame=tab.document.getElementById('pdfprint');
   frame.onload=()=>{try{frame.contentWindow.focus();frame.contentWindow.print();}catch(err){msg('Usa Ctrl + P en la ventana de impresión.',true);}};
   frame.src=url;
   tab.addEventListener('beforeunload',()=>URL.revokeObjectURL(url),{once:true});
   return;
  }
  const result=await ctx.db.storage.from(BUCKET).createSignedUrl(d.storage_path,120,mode==='download'?{download:d.original_filename}:{});
  if(result.error)throw result.error;
  if(mode==='download'){
   const link=document.createElement('a');link.href=result.data.signedUrl;link.download=d.original_filename;document.body.appendChild(link);link.click();link.remove();
   msg('Descarga solicitada: '+d.original_filename);return;
  }
  if(!tab){msg('Habilita las ventanas emergentes para abrir el archivo.',true);return;}
  tab.location.replace(result.data.signedUrl);
 }catch(e){tab?.close();msg('No se pudo acceder al archivo: '+e.message,true);}
}
document.addEventListener('click',e=>{
 if(!root())return;
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.mdStatusFilter){statusFilter=b.dataset.mdStatusFilter;draw();}if(b.id==='md-upload')upload();
 if(b.id==='md-refresh')refresh();
 if(b.dataset.mdExport)exportMaster(b.dataset.mdExport);if(b.dataset.mdOpen)openFile(b.dataset.mdOpen);if(b.dataset.mdDownload)openFile(b.dataset.mdDownload,'download');if(b.dataset.mdPrint)openFile(b.dataset.mdPrint,'print');if(b.dataset.mdDelete)deleteDocument(b.dataset.mdDelete);
 if(b.dataset.mdFolder){const [s]=b.dataset.mdFolder.split(':');system=s;document.getElementById('md-system').value=s;folders();document.getElementById('md-type').value=b.dataset.mdFolder;draw();}
});
document.addEventListener('change',e=>{if(!root())return;if(e.target.id==='md-file')preview();if(e.target.id==='md-system'){system=e.target.value;draw();}if(e.target.id==='md-type')draw();if(e.target.id==='md-status-filter'){statusFilter=e.target.value;draw();}if(e.target.dataset.mdStatus)setStatus(e.target.dataset.mdStatus,e.target.value);});
document.addEventListener('input',e=>{if(!root())return;if(e.target.id==='md-search'){query=e.target.value;draw();}});
window.ssomaMasterDocuments={page,parse,TYPES};
})();