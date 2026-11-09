/* Módulo 05 · Control operativo diario · Proyecto Lagunas */
window.ssomaDailyControls=(()=>{
 let ctx=null,records=[];
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
 const root=()=>document.getElementById('dailyControlRoot');
 const date=()=>new Date().toLocaleDateString('en-CA');
 function page(context){
  ctx=context;
  return '<div id="dailyControlRoot"><div class="card"><h2>Control operativo diario · Lagunas</h2><p class="muted">Registro por fecha, frente, turno y contratista. ATS, PETAR y checklist con estado de revisión.</p><div class="flex" style="gap:8px;flex-wrap:wrap"><span class="pill blue">Registros: <b id="dc-total">—</b></span><span class="pill">Pendientes: <b id="dc-pending">—</b></span><span class="pill">Conformes: <b id="dc-ok">—</b></span></div></div><div class="card" style="margin-top:14px"><h3>Nuevo control</h3><form id="dc-form" class="formgrid"><label>Fecha<input name="work_date" type="date" required value="'+date()+'"></label><label>Frente de trabajo<input name="work_front" required maxlength="120" placeholder="Ej. Torre A · nivel 3"></label><label>Turno<select name="shift"><option value="DIA">Día</option><option value="NOCHE">Noche</option></select></label><label>Contratista<select name="contractor_id"><option value="">Sin asignar</option>'+context.state.contractors.map(c=>'<option value="'+esc(c.id)+'">'+esc(c.name)+'</option>').join('')+'</select></label><label>Actividad<input name="activity" required maxlength="200" placeholder="Descripción de la actividad"></label><label>Tipo<select name="control_type"><option>ATS</option><option>PETAR</option><option>CHECKLIST</option></select></label><label>Código del formato<input name="reference_code" maxlength="100" placeholder="Ej. SGSST-ATS-001"></label><label>Estado<select name="status"><option value="PENDIENTE">Pendiente</option><option value="EN_REVISION">En revisión</option><option value="CONFORME">Conforme</option><option value="OBSERVADO">Observado</option></select></label><label style="grid-column:1/-1">Observaciones<textarea name="notes" rows="2" maxlength="2000"></textarea></label><div><button class="btn green" type="submit">Guardar control</button></div></form><p class="muted">El código referencia un formato de Gestión Documental; este registro no reemplaza la firma ni constituye una autorización PETAR.</p></div><div class="card" style="margin-top:14px"><div class="flex between"><h3>Controles registrados</h3><button class="btn light" id="dc-refresh" type="button">↻ Actualizar</button></div><div id="dc-list" class="tablewrap">Cargando…</div></div></div>';
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
  document.getElementById('dc-list').innerHTML=records.length?'<table><thead><tr><th>Fecha</th><th>Frente</th><th>Empresa</th><th>Actividad</th><th>Control</th><th>Código</th><th>Estado</th></tr></thead><tbody>'+records.map(r=>'<tr><td>'+esc(r.work_date)+'</td><td>'+esc(r.work_front)+' · '+esc(r.shift)+'</td><td>'+esc(ctx.state.contractors.find(c=>c.id===r.contractor_id)?.name||'—')+'</td><td>'+esc(r.activity)+'</td><td>'+esc(r.control_type)+'</td><td>'+esc(r.reference_code||'—')+'</td><td>'+esc(r.status)+'</td></tr>').join('')+'</tbody></table>':'<p class="muted">Todavía no hay controles registrados para Lagunas.</p>';
 }
 function init(){
  const el=root();if(!el)return;
  if(window.__ssomaReadOnly){el.querySelectorAll('#dc-form input,#dc-form select,#dc-form textarea,#dc-form button').forEach(x=>x.disabled=true)}
  el.querySelector('#dc-refresh').addEventListener('click',refresh);
  el.querySelector('#dc-form').addEventListener('submit',async e=>{
   e.preventDefault();if(window.__ssomaReadOnly)return;
   const f=e.currentTarget,button=f.querySelector('[type=submit]');button.disabled=true;
   const data=Object.fromEntries(new FormData(f));
   const payload={project_id:ctx.state.projectId,owner_id:ctx.session.user.id,work_date:data.work_date,work_front:data.work_front.trim(),shift:data.shift,contractor_id:data.contractor_id||null,activity:data.activity.trim(),control_type:data.control_type,reference_code:data.reference_code.trim()||null,status:data.status,notes:data.notes.trim()||null};
   try{const {error}=await ctx.db.from('ssoma_daily_controls').insert(payload);if(error)throw error;ctx.toast('Control operativo guardado');f.reset();f.elements.work_date.value=date();await refresh()}catch(err){ctx.toast('Error al guardar: '+err.message,true)}finally{button.disabled=false}
  });
  refresh();
 }
 return {page,init};
})();