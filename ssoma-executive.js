(function(){
'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
const delta=(a,b)=>Math.round((Date.parse(a+'T12:00:00')-Date.parse(b+'T12:00:00'))/86400000);
function analyze(state){
 const now=today(),active=state.personnel.filter(p=>p.active),docs=state.documents||[],auth=state.authorizations||[],tr=state.trainings||[];
 const people=active.map(p=>{
  const req=['DNI','EMO','SCTR_SALUD','SCTR_PENSION'].map(kind=>{
   const doc=docs.find(x=>x.person_id===p.id&&x.document_type===kind);
   const days=doc?.expiry_date?delta(doc.expiry_date,now):null;
   const ok=days!==null&&days>=0&&(kind!=='EMO'||doc.fitness_status==='APTO');
   return {kind,doc,days,ok};
  });
  const last=tr.filter(t=>t.person_id===p.id).sort((a,b)=>String(b.training_date).localeCompare(String(a.training_date)))[0];
  const induction=!!last&&last.result==='Aprobado'&&last.validity_until>=now&&last.score!=null&&Number(last.score)>=Number(last.passing_score??14);
  const approval=auth.filter(a=>a.person_id===p.id).sort((a,b)=>String(b.decided_at).localeCompare(String(a.decided_at)))[0];
  const authorized=approval?.decision==='HABILITADO'&&(!last?.created_at||new Date(approval.decided_at)>=new Date(last.created_at));
  const eligible=induction&&authorized&&req.every(r=>r.ok);
  return {p,req,induction,authorized,eligible,alerts:req.filter(r=>r.days===null||r.days<=15),contractor:state.contractors.find(c=>c.id===p.contractor_id)?.name||'Sin contratista'};
 });
 return {now,people};
}
function page(state){
 const {now,people}=analyze(state);
 const rows=state.contractors.map(c=>{const ps=people.filter(x=>x.p.contractor_id===c.id),enabled=ps.filter(x=>x.eligible).length,issues=ps.reduce((n,x)=>n+x.alerts.length,0);return {name:c.name,total:ps.length,enabled,issues,rate:ps.length?Math.round(enabled/ps.length*100):0}}).sort((a,b)=>a.rate-b.rate||b.total-a.total);
 const alerts=people.flatMap(x=>x.alerts.map(a=>({...a,name:x.p.full_name,contractor:x.contractor}))).sort((a,b)=>(a.days??-999)-(b.days??-999));
 const soon=alerts.filter(x=>x.days!==null&&x.days>=0&&x.days<=15).length;
 const expired=alerts.filter(x=>x.days===null||x.days<0).length;
 const cards=[['Trabajadores activos',people.length],['Habilitados',people.filter(x=>x.eligible).length],['Pendientes / vencidos',expired],['Vencen en 15 días',soon]];
 return '<div class="hero-v2"><div><h2>Gestión ejecutiva SSOMA</h2><p>Cumplimiento por contratista · alertas documentales · reportes</p></div></div>'+
 '<div class="alerts-v2">'+cards.map(([label,n])=>'<div class="alert-v2"><strong>'+n+'</strong><small>'+esc(label)+'</small></div>').join('')+'</div>'+
 '<div class="card section"><h3>Cumplimiento documental y habilitación por contratista</h3><p class="muted">Se exige inducción aprobada, autorización SSOMA y DNI, EMO, SCTR Salud y SCTR Pensión vigentes. El resultado es orientativo y no sustituye la verificación operativa.</p><div class="tablewrap"><table><thead><tr><th>Contratista</th><th>Personal</th><th>Habilitados</th><th>Cumplimiento</th><th>Observaciones</th></tr></thead><tbody>'+rows.map(r=>'<tr><td><b>'+esc(r.name)+'</b></td><td>'+r.total+'</td><td>'+r.enabled+'</td><td><div style="min-width:110px"><b>'+r.rate+'%</b><div style="height:7px;background:#e8eef3;border-radius:9px"><div style="height:7px;width:'+r.rate+'%;background:'+(r.rate>=90?'#00947b':r.rate>=70?'#e3a43a':'#c65a52')+';border-radius:9px"></div></div></div></td><td>'+r.issues+'</td></tr>').join('')+'</tbody></table></div></div>'+
 '<div class="card section"><h3>Alertas anticipadas: 15, 7 y 3 días</h3><p class="muted">Se calculan al consultar el sistema; no se envían notificaciones al celular todavía.</p><div class="tablewrap"><table><thead><tr><th>Trabajador</th><th>Contratista</th><th>Documento</th><th>Vencimiento</th><th>Prioridad</th></tr></thead><tbody>'+alerts.slice(0,100).map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+esc(x.contractor)+'</td><td>'+esc(x.kind.replaceAll('_',' '))+'</td><td>'+esc(x.doc?.expiry_date||'Sin registro')+'</td><td>'+esc(x.days===null?'Sin registro':x.days<0?'Vencido':x.days<=3?'3 días':x.days<=7?'7 días':'15 días')+'</td></tr>').join('')+'</tbody></table></div>'+(alerts.length>100?'<p class="muted">Mostrando las primeras 100 alertas. Exporte el CSV para ver todas.</p>':'')+'</div>'+
 '<div class="card section"><h3>Informes y exportaciones</h3><p class="muted">Descargue un consolidado CSV para Excel o un informe HTML imprimible para PDF.</p><div class="actions"><button class="btn green" data-exec-report="csv">↓ Consolidado CSV</button><button class="btn light" data-exec-report="print">↓ Informe ejecutivo PDF (imprimir)</button></div></div>';
}
function csv(state){
 const {people}=analyze(state);
 const data=[['Contratista','DNI','Trabajador','Inducción aprobada','Autorización SSOMA','DNI vigente','EMO vigente','SCTR Salud vigente','SCTR Pensión vigente','Habilitación']];
 for(const x of people){const ok=k=>x.req.find(r=>r.kind===k)?.ok?'Sí':'No';data.push([x.contractor,x.p.dni,x.p.full_name,x.induction?'Sí':'No',x.authorized?'Sí':'No',ok('DNI'),ok('EMO'),ok('SCTR_SALUD'),ok('SCTR_PENSION'),x.eligible?'HABILITADO':'NO HABILITADO'])}
 const content='\ufeff'+data.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='SSOMA_Consolidado_'+today()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function printReport(state){
 const w=window.open('','_blank');if(!w)throw Error('Permita ventanas emergentes para generar el informe');
 const {people}=analyze(state),date=today(),by=state.contractors.map(c=>{const ps=people.filter(x=>x.p.contractor_id===c.id);return {name:c.name,n:ps.length,ok:ps.filter(x=>x.eligible).length}}).filter(x=>x.n);
 const html='<!doctype html><html lang="es"><meta charset="utf-8"><title>Informe ejecutivo SSOMA</title><style>body{font:14px Arial;margin:40px;color:#18334b}h1{color:#007d74}table{border-collapse:collapse;width:100%}td,th{padding:10px;border-bottom:1px solid #dce6ec;text-align:left}th{background:#e7f5f1}.meta{color:#5c6b7b}.summary{padding:15px;background:#f1f7fa;border-radius:9px}@media print{button{display:none}}</style><h1>Informe ejecutivo SSOMA</h1><p class="meta">Corte: '+date+' · Datos del sistema</p><div class="summary">Personal activo: <b>'+people.length+'</b> · Habilitados: <b>'+people.filter(x=>x.eligible).length+'</b> · Pendientes: <b>'+people.filter(x=>!x.eligible).length+'</b></div><h2>Contratistas</h2><table><tr><th>Contratista</th><th>Personal</th><th>Habilitados</th><th>%</th></tr>'+by.map(x=>'<tr><td>'+esc(x.name)+'</td><td>'+x.n+'</td><td>'+x.ok+'</td><td>'+Math.round(x.ok/x.n*100)+'%</td></tr>').join('')+'</table><p class="meta">Informe de control documental. No acredita por sí mismo la habilitación para tareas críticas.</p><button onclick="window.print()">Imprimir / Guardar como PDF</button></html>';
 w.document.write(html);w.document.close();
}
window.ssomaExecutive={page,analyze,csv,printReport};
})();