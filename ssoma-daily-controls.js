/* Módulo 05 · Control operativo diario · Proyecto Lagunas */
window.ssomaDailyControls=(()=>{
 let ctx=null,records=[],editingId=null;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
 const root=()=>document.getElementById('dailyControlRoot');
 const date=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
 function page(context){
  ctx=context;
  return '<div id="dailyControlRoot"><div class="card"><h2>Control operativo diario · Lagunas</h2><p class="muted">Registro por fecha, frente, turno y contratista. ATS, PETAR y checklist con estado de revisión.</p><div class="flex" style="gap:8px;flex-wrap:wrap"><span class="pill blue">Registros: <b id="dc-total">—</b></span><span class="pill">Pendientes: <b id="dc-pending">—</b></span><span class="pill">Conformes: <b id="dc-ok">—</b></span></div></div><div class="card" style="margin-top:14px"><h3 id="dc-form-title">Nuevo control</h3><form id="dc-form" class="formgrid"><label>Fecha<input name="work_date" type="date" required value="'+date()+'"></label><label>Frente de trabajo<input name="work_front" required maxlength="120" placeholder="Ej. Torre A · nivel 3"></label><label>Turno<select name="shift"><option value="DIA">Día</option><option value="NOCHE">Noche</option></select></label><label>Contratista<select name="contractor_id"><option value="">Sin asignar</option>'+context.state.contractors.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('')+'</select></label><label>Actividad<input name="activity" required maxlength="200" placeholder="Descripción de la actividad"></label><label>Tipo<select name="control_type"><option>ATS</option><option>PETAR</option><option>CHECKLIST</option></select></label><label>Código del formato<input name="reference_code" maxlength="100" placeholder="Ej. SGSST-ATS-001"></label><label>Estado<select name="status"><option value="PENDIENTE">Pendiente</option><option value="EN_REVISION">En revisión</option><option value="CONFORME">Conforme</option><option value="OBSERVADO">Observado</option></select></label><label style="grid-column:1/-1">Observaciones<textarea name="notes" rows="2" maxlength="2000"></textarea></label><div class="flex" style="gap:8px;flex-wrap:wrap"><button class="btn green" type="submit" id="dc-save">Guardar control</button><button class="btn light" type="button" id="dc-cancel" style="display:none">Cancelar edición</button></div></form><p class="muted">El código referencia un formato de Gestión Documental; este registro no reemplaza la firma ni constituye una autorización PETAR.</p></div><div class="card" style="margin-top:14px"><div class="flex between"><h3>Controles registrados</h3><button class="btn light" id="dc-refresh" type="button">↻ Actualizar</button></div><div class="flex" style="gap:8px;flex-wrap:wrap;margin:12px 0"><input id="dc-filter-date" type="date" aria-label="Filtrar por fecha"><select id="dc-filter-type" aria-label="Filtrar tipo"><option value="">Todos los controles</option><option>ATS</option><option>PETAR</option><option>CHECKLIST</option></select><select id="dc-filter-status" aria-label="Filtrar estado"><option value="">Todos los estados</option><option value="PENDIENTE">Pendiente</option><option value="EN_REVISION">En revisión</option><option value="CONFORME">Conforme</option><option value="OBSERVADO">Observado</option></select><button class="btn light" id="dc-export" type="button">Exportar CSV</button></div><div id="dc-list" class="tablewrap">Cargando…</div></div></div>';
 }
 async function refresh(){
  if(!ctx?.state?.projectId)return;
  const {data,error}=await ctx.db.from('ssoma_daily_controls').select('*').eq('project_id',ctx.state.projectId).order('work_date',{ascending:false}).limit(500);
  if(error){ctx.toast('No se pudo cargar control operativo: '+error.message,true);return}
  records=data||[];
  if(!root())return;
  document.getElementById('dc-total').textContent=records.length;
  document.getElementById('dc-pending').textContent=records.filter(r=>r.status==='PENDIENTE').length;
  document.getElementById('dc-ok').textContent=records.filter(r=>r.status==='CONFORME').length;
  renderList();

 }

 function filtered(){
  const el=root();if(!el)return [];
  const dt=el.querySelector('#dc-filter-date').value,ty=el.querySelector('#dc-filter-type').value,st=el.querySelector('#dc-filter-status').value;
  return records.filter(r=>(!dt||r.work_date===dt)&&(!ty||r.control_type===ty)&&(!st||r.status===st));
 }
 function renderList(){
  const el=root();if(!el)return;const rows=filtered();
  el.querySelector('#dc-list').innerHTML=rows.length?'<table><thead><tr><th>Fecha</th><th>Frente</th><th>Empresa</th><th>Actividad</th><th>Control</th><th>Código</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.work_date)+'</td><td>'+esc(r.work_front)+' · '+esc(r.shift)+'</td><td>'+esc(ctx.state.contractors.find(c=>c.id===r.contractor_id)?.name||'—')+'</td><td>'+esc(r.activity)+'</td><td>'+esc(r.control_type)+'</td><td>'+esc(r.reference_code||'—')+'</td><td>'+esc(r.status)+'</td><td>'+(window.__ssomaReadOnly?'Solo lectura':'<button class="btn light" type="button" data-dc-edit="'+esc(r.id)+'">Editar</button>')+'</td></tr>').join('')+'</tbody></table>':'<p class="muted">No hay registros para los filtros seleccionados.</p>';
 }
 function resetForm(){
  editingId=null;const el=root();if(!el)return;const f=el.querySelector('#dc-form');f.reset();f.elements.work_date.value=date();el.querySelector('#dc-form-title').textContent='Nuevo control';el.querySelector('#dc-save').textContent='Guardar control';el.querySelector('#dc-cancel').style.display='none';
 }
 function startEdit(id){
  const record=records.find(r=>r.id===id);if(!record||window.__ssomaReadOnly)return;
  const el=root(),f=el.querySelector('#dc-form');editingId=id;
  for(const name of ['work_date','work_front','shift','contractor_id','activity','control_type','reference_code','status','notes'])if(f.elements[name])f.elements[name].value=record[name]??'';
  el.querySelector('#dc-form-title').textContent='Editar control existente';el.querySelector('#dc-save').textContent='Guardar cambios';el.querySelector('#dc-cancel').style.display='';
  f.scrollIntoView({behavior:'smooth',block:'start'});
 }
 function exportCsv(){
  const cols=['work_date','work_front','shift','contractor_id','activity','control_type','reference_code','status','notes'];
  const csv=[cols.join(','),...filtered().map(r=>cols.map(k=>'"'+String(r[k]??'').replace(/"/g,'""')+'"').join(','))].join('\r\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='lagunas_control_operativo_'+date()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 function init(){
  const el=root();if(!el)return;
  if(window.__ssomaReadOnly){el.querySelectorAll('#dc-form input,#dc-form select,#dc-form textarea,#dc-form button').forEach(x=>x.disabled=true)}
  el.querySelector('#dc-refresh').addEventListener('click',refresh);
  ['dc-filter-date','dc-filter-type','dc-filter-status'].forEach(id=>el.querySelector('#'+id).addEventListener('change',renderList));
  el.querySelector('#dc-export').addEventListener('click',exportCsv);
  el.querySelector('#dc-cancel').addEventListener('click',resetForm);
  el.querySelector('#dc-list').addEventListener('click',e=>{const b=e.target.closest('[data-dc-edit]');if(b)startEdit(b.dataset.dcEdit)});
  el.querySelector('#dc-form').addEventListener('submit',async e=>{
   e.preventDefault();if(window.__ssomaReadOnly)return;
   const f=e.currentTarget,button=f.querySelector('[type=submit]');button.disabled=true;
   const data=Object.fromEntries(new FormData(f));
   const payload={project_id:ctx.state.projectId,owner_id:ctx.session.user.id,work_date:data.work_date,work_front:data.work_front.trim(),shift:data.shift,contractor_id:data.contractor_id||null,activity:data.activity.trim(),control_type:data.control_type,reference_code:data.reference_code.trim()||null,status:data.status,notes:data.notes.trim()||null};
   try{const query=editingId?ctx.db.from('ssoma_daily_controls').update(payload).eq('id',editingId).eq('project_id',ctx.state.projectId).eq('owner_id',ctx.session.user.id):ctx.db.from('ssoma_daily_controls').insert(payload);const {error}=await query;if(error)throw error;ctx.toast(editingId?'Control operativo actualizado':'Control operativo guardado');resetForm();await refresh()}catch(err){ctx.toast('Error al guardar: '+err.message,true)}finally{button.disabled=false}
  });
  refresh();
 }
 return {page,init};
})();