/* Lista Maestra Documental SGSST / SGA */
(function(){
'use strict';
const BUCKET='ssoma-master-docs', TABLE='ssoma_master_documents';
const TYPES={SGSST:{ATS:'ATS',PETAR:'PETAR',PETS:'PETS',CHK:'Checklists',IPERC:'IPERC',INS:'Inspecciones SST',REG:'Registros',OTR:'Otros SST'},SGA:{INS:'Inspecciones ambientales',RES:'Residuos',MON:'Monitoreos',DER:'Control de derrames',CHK:'Checklists ambientales',PETS:'Procedimientos',REG:'Registros',OTR:'Otros ambientales'}};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const parse=name=>{
 const m=/^(SGSST|SGA)-([A-Z0-9]{2,12})-(\d{3,})_(.+)_V(\d{2,3})\.pdf$/i.exec(name.trim());
 if(!m)return null;
 const system=m[1].toUpperCase(),type=m[2].toUpperCase(),version=Number(m[5]);
 if(!TYPES[system][type]||!version||version>999)return null;
 return {system_code:system,document_type:type,document_code:system+'-'+type+'-'+m[3],document_name:m[4].replace(/[_\s]+/g,' ').trim(),version_number:version,original_filename:name};
};
let ctx=null,docs=[],system='TODOS',query='',busy=false;
const root=()=>document.getElementById('masterDocumentsRoot');
const msg=(s,bad=false)=>ctx?.toast?.(s,bad);
function page(c){ctx=c;system=c.initialSystem||'TODOS';query='';docs=[];setTimeout(refresh,0);return `<section id="masterDocumentsRoot" class="md-root">
<div class="md-hero"><div><span class="md-eyebrow">SSOMA CONTROL 2.0 · Gestión integrada</span><h2>Lista Maestra Documental</h2><p>Biblioteca central SGSST y SGA · Codificación y versiones automáticas</p></div><div class="md-hero-icon">▤</div></div>
<div class="md-tabs" role="tablist" aria-label="Sistema documental"><button type="button" data-md-tab="TODOS" class="md-tab active">▤ Lista Maestra</button><button type="button" data-md-tab="SGSST" class="md-tab">▣ SGSST · Permisos de Trabajo</button><button type="button" data-md-tab="SGA" class="md-tab">♧ SGA · Gestión Ambiental</button></div><div class="md-grid"><div class="md-tile"><strong id="md-total">—</strong><span>Versiones registradas</span></div><div class="md-tile"><strong id="md-sst">—</strong><span>SGSST</span></div><div class="md-tile"><strong id="md-sga">—</strong><span>SGA</span></div><div class="md-tile"><strong id="md-pending">—</strong><span>Pendientes de aprobación</span></div></div>
<div class="card md-panel"><div class="md-panel-title"><div><h3>Cargar documentos PDF</h3><p class="muted">El nombre codificado genera automáticamente el registro. Hasta 20 MB por archivo.</p></div></div>
<div class="md-upload-controls"><label>Sistema documental<select id="md-upload-system"><option value="SGSST">SGSST · Seguridad y Salud</option><option value="SGA">SGA · Gestión Ambiental</option></select></label><label class="md-filelabel">Seleccionar PDF<input id="md-file" type="file" accept=".pdf,application/pdf" multiple></label><button type="button" id="md-upload" class="btn green">↑ Subir y registrar</button></div>
<div id="md-preview" class="md-preview muted">Ejemplo: SGSST-ATS-001_Analisis_de_trabajo_seguro_V01.pdf</div><p class="muted">Los documentos cargados quedan PENDIENTES hasta su revisión y aprobación. No se publican automáticamente como vigentes.</p></div>
<div class="card md-panel"><div class="md-panel-title"><div><h3>Biblioteca y Lista Maestra</h3><p class="muted">Búsqueda por código, nombre, tipo, sistema o versión</p></div><button id="md-refresh" class="btn light small">↻ Actualizar</button></div>
<div class="md-toolbar"><input id="md-search" placeholder="Buscar: SGSST-ATS-001, inspección, V02..." aria-label="Buscar documentos"><select id="md-system"><option value="TODOS">Todos los sistemas</option><option value="SGSST">SGSST</option><option value="SGA">SGA</option></select><select id="md-type"><option value="TODOS">Todas las carpetas</option></select></div>
<div id="md-folders" class="md-folders"></div><div class="tablewrap"><table class="md-table"><thead><tr><th>Sistema / Carpeta</th><th>Código</th><th>Documento</th><th>Versión</th><th>Estado</th><th>Carga</th><th>Archivo</th><th>Acciones</th></tr></thead><tbody id="md-rows"><tr><td colspan="8">Cargando documentos...</td></tr></tbody></table></div><p class="muted md-note">Cada versión se conserva como registro independiente. El historial no se sobrescribe.</p></div></section>`;}
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
 n('md-total').textContent=docs.length;n('md-sst').textContent=docs.filter(d=>d.system_code==='SGSST').length;n('md-sga').textContent=docs.filter(d=>d.system_code==='SGA').length;n('md-pending').textContent=docs.filter(d=>d.status==='PENDIENTE').length;
 folders();
 document.querySelectorAll('[data-md-tab]').forEach(b=>{b.classList.toggle('active',b.dataset.mdTab===system);b.setAttribute('aria-selected',String(b.dataset.mdTab===system));});const type=n('md-type').value;
 const rows=docs.filter(d=>(system==='TODOS'||d.system_code===system)&&(type==='TODOS'||type===d.system_code+':'+d.document_type)&&[d.document_code,d.document_name,d.document_type,d.system_code,'V'+String(d.version_number).padStart(2,'0')].join(' ').toLowerCase().includes(query.toLowerCase()));
 n('md-rows').innerHTML=rows.length?rows.map(d=>`<tr><td><span class="md-system ${d.system_code==='SGA'?'env':''}">${esc(d.system_code)}</span><br><small>${esc(TYPES[d.system_code]?.[d.document_type]||d.document_type)}</small></td><td><b>${esc(d.document_code)}</b></td><td>${esc(d.document_name)}</td><td>V${String(d.version_number).padStart(2,'0')}</td><td><select class="md-status-select" data-md-status="${esc(d.id)}" aria-label="Estado de ${esc(d.document_code)}"><option value="PENDIENTE" ${d.status==='PENDIENTE'?'selected':''}>En revisión</option><option value="VIGENTE" ${d.status==='VIGENTE'?'selected':''}>Válido / Vigente</option><option value="OBSOLETO" ${d.status==='OBSOLETO'?'selected':''}>Obsoleto</option></select></td><td>${new Date(d.uploaded_at).toLocaleDateString('es-PE')}</td><td><button type="button" class="btn light small" data-md-open="${esc(d.id)}">Ver PDF</button></td><td><button type="button" class="btn red small" data-md-delete="${esc(d.id)}" aria-label="Eliminar ${esc(d.document_code)} versión ${d.version_number}">Eliminar</button></td></tr>`).join(''):'<tr><td colspan="7" class="muted">No se encontraron documentos.</td></tr>';
}
async function refresh(){
 if(!ctx||!root())return;
 const r=await ctx.db.from(TABLE).select('*').order('uploaded_at',{ascending:false}).limit(5000);
 if(r.error){msg('No se pudo consultar la Lista Maestra: '+r.error.message,true);document.getElementById('md-rows').innerHTML='<tr><td colspan="7">Error al cargar. Verifica tu conexión.</td></tr>';return;}
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
 if(items.some(x=>!x.p||x.p.system_code!==sel||x.f.size>20971520||x.f.size===0||!x.f.name.toLowerCase().endsWith('.pdf')))return msg('Revisa código, sistema, tipo, versión y tamaño (máx. 20 MB).',true);
 if(new Set(items.map(x=>x.p.document_code+':'+x.p.version_number)).size!==items.length)return msg('La selección contiene códigos y versiones repetidos.',true);
 busy=true;const button=document.getElementById('md-upload');button.disabled=true;button.textContent='Subiendo...';
 let ok=0,fail=[];
 try{
  const u=await ctx.db.auth.getUser();if(u.error||!u.data.user)throw Error('Sesión no válida');
  for(const {f,p} of items){
   const exists=await ctx.db.from(TABLE).select('id').eq('document_code',p.document_code).eq('version_number',p.version_number).maybeSingle();
   if(exists.error){fail.push(f.name+': '+exists.error.message);continue;}
   if(exists.data){fail.push(f.name+': versión ya registrada');continue;}
   const path=[u.data.user.id,p.system_code,p.document_type,p.document_code,'V'+String(p.version_number).padStart(2,'0'),crypto.randomUUID()+'.pdf'].join('/');
   const put=await ctx.db.storage.from(BUCKET).upload(path,f,{contentType:'application/pdf',upsert:false});
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
  if(current){msg('Primero marca como obsoleta la versión vigente de '+d.document_code+'. Solo puede existir una versión vigente.',true);draw();return;}
  if(!window.confirm('¿Confirmas que revisaste y validaste '+d.document_code+' V'+String(d.version_number).padStart(2,'0')+'? Esta acción cambia su estado a VIGENTE.')){draw();return;}
 }
 busy=true;
 try{
  const r=await ctx.db.from(TABLE).update({status:newStatus,approved_at:newStatus==='VIGENTE'?new Date().toISOString():null}).eq('id',id).select('id').single();
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
async function openFile(id){
 const d=docs.find(x=>x.id===id);if(!d)return;
 const r=await ctx.db.storage.from(BUCKET).createSignedUrl(d.storage_path,90);
 if(r.error)return msg('No se pudo abrir el documento: '+r.error.message,true);
 window.open(r.data.signedUrl,'_blank','noopener,noreferrer');
}
document.addEventListener('click',e=>{
 if(!root())return;
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.mdTab){system=b.dataset.mdTab;document.getElementById('md-system').value=system;document.getElementById('md-type').value='TODOS';draw();}if(b.id==='md-upload')upload();
 if(b.id==='md-refresh')refresh();
 if(b.dataset.mdOpen)openFile(b.dataset.mdOpen);if(b.dataset.mdDelete)deleteDocument(b.dataset.mdDelete);
 if(b.dataset.mdFolder){const [s]=b.dataset.mdFolder.split(':');system=s;document.getElementById('md-system').value=s;folders();document.getElementById('md-type').value=b.dataset.mdFolder;draw();}
});
document.addEventListener('change',e=>{if(!root())return;if(e.target.id==='md-file')preview();if(e.target.id==='md-system'){system=e.target.value;draw();}if(e.target.id==='md-type')draw();if(e.target.dataset.mdStatus)setStatus(e.target.dataset.mdStatus,e.target.value);});
document.addEventListener('input',e=>{if(!root())return;if(e.target.id==='md-search'){query=e.target.value;draw();}});
window.ssomaMasterDocuments={page,parse,TYPES};
})();