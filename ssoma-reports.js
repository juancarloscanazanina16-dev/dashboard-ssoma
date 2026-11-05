(function(){
'use strict';
let current=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=v=>Number(v)||0;
const fmt=v=>Number(v).toLocaleString('es-PE',{maximumFractionDigits:2});
const date=s=>new Date(s+'T12:00:00');
const iso=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const week=end=>{const d=date(end);const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);return iso(d)};
const row=(a,b)=>'<tr><th>'+esc(a)+'</th><td>'+esc(b)+'</td></tr>';
function page(){return '<section class="ir-root"><div class="ir-intro"><b>Consolidación semanal automatizada</b><span>Datos registrados en Supabase · Revisión previa a emisión</span></div><div class="ir-controls"><label>Fecha de referencia<input type="date" id="ir-date" value="2026-11-05"></label><button type="button" class="btn green" id="ir-generate">Generar borrador semanal</button><button type="button" class="btn light" id="ir-pdf" disabled>Exportar PDF</button><button type="button" class="btn light" id="ir-word" disabled>Exportar Word</button></div><div id="ir-status" class="ir-note">Selecciona el periodo y genera un borrador. No se inventan registros faltantes.</div><div id="ir-preview"></div><div class="ir-old"><details><summary>Exportaciones originales (CSV)</summary><div class="actions"><button class="btn green" data-export="personnel">Personal (CSV)</button><button class="btn" data-export="trainings">Inducciones y reinducciones (CSV)</button><button class="btn light" data-export="validity">Vigencias (CSV)</button></div></details></div></section>'}
function table(rows){return '<table class="ir-table">'+rows.map(r=>row(r[0],r[1])).join('')+'</table>'}
function setStatus(message,err=false){const el=document.getElementById('ir-status');if(el){el.textContent=message;el.style.color=err?'#a32437':'#47647e'}}
async function generate(){
 const ctx=window.sctrContext,el=document.getElementById('ir-date');if(!ctx?.db||!el)return;
 const end=el.value;if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(end)){setStatus('Selecciona una fecha válida.',true);return}
 const start=week(end);current=null;document.getElementById('ir-pdf').disabled=true;document.getElementById('ir-word').disabled=true;
 setStatus('Consultando registros del '+start+' al '+end+'…');
 const db=ctx.db,queries=[
 db.from('ssoma_daily_hours').select('work_date,contractor_id,staff_count,operative_count,staff_hours,operative_hours').gte('work_date',start).lte('work_date',end).limit(10000),
 db.from('ssoma_events').select('event_date,event_type,severity,days_lost,status,description').gte('event_date',start).lte('event_date',end).limit(10000),
 db.from('ssoma_inspections').select('id,inspection_date,contractor_id,inspection_type,area').gte('inspection_date',start).lte('inspection_date',end).limit(10000),
 db.from('ssoma_findings').select('id,inspection_id,status,risk,description,corrective_action,responsible,due_date,created_at').limit(10000),
 db.from('ssoma_event_actions').select('id,status,description,responsible,due_date,created_at').limit(10000)
 ];
 let results;try{results=await Promise.all(queries)}catch(e){setStatus('Error de conexión: '+e.message,true);return}
 const errors=results.map((r,i)=>r.error?['HHT','Eventos','Inspecciones','Hallazgos','Acciones'][i]+': '+r.error.message:null).filter(Boolean);
 if(errors.length){setStatus('No se emitió el informe porque faltan fuentes: '+errors.join(' | '),true);return}
 const [hours,events,inspections,allFindings,allActions]=results.map(r=>r.data||[]);
 const warnings=[];if(results.some(r=>r.data?.length===10000))warnings.push('Alguna consulta alcanzó 10 000 filas: verificar paginación.');
 const inspectionIds=new Set(inspections.map(x=>x.id));
 const findings=allFindings.filter(x=>inspectionIds.has(x.inspection_id));
 const actions=allActions.filter(x=>x.created_at?.slice(0,10)>=start&&x.created_at?.slice(0,10)<=end);
 const trainings=(ctx.state.trainings||[]).filter(x=>x.training_date>=start&&x.training_date<=end);
 const active=(ctx.state.personnel||[]).filter(x=>x.active);
 const contractors=ctx.state.contractors||[];
 const hht=hours.reduce((v,x)=>v+n(x.staff_hours)+n(x.operative_hours),0);
 const accidents=events.filter(x=>x.event_type==='ACCIDENTE');
 const incapacitating=accidents.filter(x=>['INCAPACITANTE','MORTAL'].includes(String(x.severity||'').toUpperCase()));
 const lost=incapacitating.reduce((v,x)=>v+n(x.days_lost),0);
 const IF=hht>0?incapacitating.length*200000/hht:null,IG=hht>0?lost*200000/hht:null,IA=hht>0?IF*IG/200:null;
 if(!hours.length)warnings.push('Sin registros diarios de horas-hombre en el periodo; índices no calculables.');
 const kinds={};trainings.forEach(t=>{const key=t.kind||'Sin clasificación';kinds[key]=(kinds[key]||0)+1});
 const subjects=[...new Set(trainings.map(t=>t.topic).filter(Boolean))];
 const open=findings.filter(f=>f.status!=='CERRADO');
 const critical=open.filter(f=>f.risk==='CRITICO');
 const names=contractors.map(c=>({name:c.name,count:active.filter(p=>p.contractor_id===c.id).length})).filter(c=>c.count);
 const noRecords=(label)=>'<p class="ir-muted">No se encontraron '+label+' registrados para este periodo.</p>';
 const bullet=items=>items.length?'<ul>'+items.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>':'';
 const html='<article class="ir-document"><div class="ir-dochead"><small>INFORME SEMANAL · SEGURIDAD, SALUD OCUPACIONAL Y MEDIO AMBIENTE</small><h2>Consolidado de gestión SSOMA</h2><p>Proyecto de Construcción Civil · '+esc(start)+' al '+esc(end)+'</p><span>BORRADOR · PENDIENTE DE REVISIÓN</span></div>'+
 '<h3>1. Resumen ejecutivo</h3><p>Durante el periodo se registraron '+fmt(hht)+' horas-hombre, '+inspections.length+' inspecciones, '+findings.length+' hallazgos y '+events.length+' eventos de seguridad. El presente consolidado corresponde exclusivamente a los registros disponibles en el sistema.</p>'+
 '<h3>2. Personal y contratistas</h3>'+table([['Personal activo registrado al consultar',active.length],['Contratistas con personal activo',names.length]])+(names.length?'<p>'+names.map(x=>esc(x.name)+': '+x.count).join(' · ')+'</p>':noRecords('contratistas con personal activo'))+
 '<h3>3. Horas-hombre e indicadores de seguridad</h3>'+table([['HHT registradas en la semana',fmt(hht)],['Días con registro HHT',new Set(hours.map(x=>x.work_date)).size],['Accidentes registrados',accidents.length],['Accidentes incapacitantes o mortales',incapacitating.length],['Días perdidos registrados',lost],['Índice de Frecuencia (IF)',IF===null?'No calculable':IF.toFixed(2)],['Índice de Gravedad (IG)',IG===null?'No calculable':IG.toFixed(2)],['Índice de Accidentabilidad (IA)',IA===null?'No calculable':IA.toFixed(2)]])+
 '<p class="ir-muted">IF e IG por 200 000 HHT; IA = IF × IG / 200. Valores orientativos sujetos a validación de registros y criterios del proyecto.</p>'+
 '<h3>4. Inducciones y capacitaciones</h3>'+table([['Registros de capacitación e inducción',trainings.length],['Duración acumulada registrada (minutos por sesión)',fmt(trainings.reduce((v,t)=>v+n(t.duration_minutes),0))],...Object.entries(kinds)])+(subjects.length?'<p><b>Temas registrados:</b> '+subjects.map(esc).join('; ')+'</p>':noRecords('temas de capacitación'))+
 '<h3>5. Inspecciones, hallazgos y acciones</h3>'+table([['Inspecciones realizadas',inspections.length],['Hallazgos asociados a inspecciones del periodo',findings.length],['Hallazgos abiertos',open.length],['Hallazgos críticos abiertos',critical.length],['Acciones de eventos creadas en el periodo',actions.length],['Acciones pendientes',actions.filter(x=>x.status!=='VERIFICADA').length]])+
 (open.length?'<p><b>Hallazgos pendientes:</b></p>'+bullet(open.slice(0,12).map(x=>(x.description||'Sin descripción')+' · Responsable: '+(x.responsible||'Por asignar')+' · Plazo: '+(x.due_date||'Sin fecha'))):noRecords('hallazgos abiertos en inspecciones de la semana'))+
 '<h3>6. Accidentes e incidentes</h3>'+table([['Eventos registrados',events.length],['Accidentes',accidents.length],['Otros eventos',events.length-accidents.length]])+(events.length?bullet(events.slice(0,12).map(x=>x.event_date+' · '+x.event_type+' · '+(x.description||'Sin descripción'))):noRecords('eventos'))+
 '<h3>7. Evidencias, observaciones y revisión</h3><p>Las evidencias fotográficas deben anexarse o verificarse en los expedientes correspondientes. Este borrador no certifica que todas las actividades ejecutadas hayan sido registradas.</p>'+
 (warnings.length?'<p><b>Advertencias de integridad:</b> '+warnings.map(esc).join(' · ')+'</p>':'')+
 '<div class="ir-review"><label>Observaciones y conclusiones del responsable<textarea id="ir-observations" rows="3" placeholder="Registrar conclusiones verificadas y compromisos…"></textarea></label><label><input type="checkbox" id="ir-reviewed"> Confirmo que revisé los registros y el contenido antes de emitir el informe</label></div>'+
 '<div class="ir-sign"><div>Elaborado por: Jefatura SSOMA<br>Firma: ____________________</div><div>Revisado por: ____________________<br>Fecha: ____________________</div></div></article>';
 document.getElementById('ir-preview').innerHTML=html;
 current={start,end,warnings,html};
 document.getElementById('ir-pdf').disabled=false;document.getElementById('ir-word').disabled=false;
 setStatus('Borrador generado desde Supabase. Revisa los datos y marca la conformidad para habilitar su exportación.');
}
function getDocument(){if(!current)return null;const check=document.getElementById('ir-reviewed');if(!check?.checked){setStatus('Antes de exportar, revisa el informe y marca la casilla de conformidad.',true);return null}const clone=document.querySelector('.ir-document').cloneNode(true);const observations=document.getElementById('ir-observations')?.value||'Sin observaciones adicionales';clone.querySelector('.ir-review').innerHTML='<p><b>Observaciones y conclusiones:</b> '+esc(observations)+'</p><p><b>Estado:</b> Revisado por el usuario antes de la exportación. No equivale a aprobación ni firma digital.</p>';clone.querySelector('.ir-dochead span').textContent='REVISADO · PENDIENTE DE APROBACIÓN';return clone.outerHTML}
const styles='body{font-family:Arial,sans-serif;color:#173651;margin:25px;font-size:11px}h2{font-size:22px}h3{background:#e9f3fa;padding:8px;color:#0b527d;margin-top:18px}table{width:100%;border-collapse:collapse}th,td{padding:6px;border:1px solid #d7e2eb;text-align:left}th{width:60%;background:#f5f9fc}.ir-dochead{border-bottom:4px solid #008e96;padding-bottom:12px}.ir-dochead span{font-weight:bold;color:#0b7880}.ir-sign{display:flex;justify-content:space-between;margin-top:35px}.ir-muted{color:#627b91}li{margin:4px 0}@page{size:A4 portrait;margin:14mm}';
function exportPdf(){const html=getDocument();if(!html)return;const w=window.open('','_blank');if(!w){setStatus('Habilita ventanas emergentes para imprimir o guardar como PDF.',true);return}w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Informe semanal SSOMA</title><style>'+styles+'</style></head><body>'+html+'</body></html>');w.document.close();w.onload=()=>{w.focus();w.print()};setStatus('En el cuadro de impresión selecciona «Guardar como PDF».');}
function exportWord(){const html=getDocument();if(!html)return;const content='<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>'+styles+'</style></head><body>'+html+'</body></html>';const blob=new Blob(['\\ufeff',content],{type:'application/msword;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Informe_SSOMA_Semanal_'+current.start+'_al_'+current.end+'.doc';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);setStatus('Archivo Word compatible (.doc) descargado.');}
function init(){const root=document.querySelector('.ir-root');if(!root)return;root.querySelector('#ir-generate').onclick=generate;root.querySelector('#ir-pdf').onclick=exportPdf;root.querySelector('#ir-word').onclick=exportWord;current=null;}
window.ssomaReports={page,init};
})();