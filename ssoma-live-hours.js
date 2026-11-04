(function(){
'use strict';
let request=0;
const months=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Setiembre','Octubre','Noviembre','Diciembre'];
const fmt=(n,d=2)=>new Intl.NumberFormat('es-PE',{minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
const num=x=>Number(x)||0;
const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
function compute(daily,events,year){
 const monthly=Array.from({length:12},(_,i)=>({month:i+1,days:new Map(),hht:0,accidents:0,computable:0,lost:0}));
 daily.forEach(r=>{
  const m=Number(String(r.work_date).slice(5,7))-1;if(m<0||m>11)return;
  const item=monthly[m],count=num(r.staff_count)+num(r.operative_count);
  item.days.set(r.work_date,(item.days.get(r.work_date)||0)+count);
  item.hht+=num(r.staff_count)*num(r.staff_hours)+num(r.operative_count)*num(r.operative_hours);
 });
 events.forEach(e=>{
  const m=Number(String(e.event_date).slice(5,7))-1;if(m<0||m>11)return;
  const kind=String(e.event_type||'').toLowerCase(),severity=String(e.severity||'').toLowerCase();
  if(!kind.includes('accident'))return;
  const item=monthly[m];item.accidents++;
  if(/incapacit|mortal|fatal/.test(severity)){item.computable++;item.lost+=Math.max(0,num(e.days_lost))}
 });
 monthly.forEach(x=>{
  const counts=[...x.days.values()];
  x.average=counts.length?counts.reduce((a,b)=>a+b,0)/counts.length:null;
  x.maximum=counts.length?Math.max(...counts):null;
  x.if=x.hht>0?x.computable*1000000/x.hht:null;
  x.ig=x.hht>0?x.lost*1000000/x.hht:null;
  x.ia=x.hht>0?x.if*x.ig/1000:null;
 });
 return monthly;
}
function render(monthly,year){
 const totalHht=monthly.reduce((n,m)=>n+m.hht,0),accidents=monthly.reduce((n,m)=>n+m.accidents,0),computable=monthly.reduce((n,m)=>n+m.computable,0),lost=monthly.reduce((n,m)=>n+m.lost,0);
 const counts=monthly.flatMap(m=>[...m.days.values()]),average=counts.length?counts.reduce((a,b)=>a+b,0)/counts.length:null,maximum=counts.length?Math.max(...counts):null;
 const ifv=totalHht?computable*1000000/totalHht:null,ig=totalHht?lost*1000000/totalHht:null,iav=totalHht?ifv*ig/1000:null;
 const value=n=>n===null?'—':fmt(n);
 const row=m=>'<tr><td>'+months[m.month-1]+'</td><td>'+m.accidents+'</td><td>'+m.computable+'</td><td>'+m.lost+'</td><td>'+(m.average===null?'—':fmt(m.average,1))+'</td><td>'+(m.maximum===null?'—':fmt(m.maximum,0))+'</td><td>'+fmt(m.hht,0)+'</td><td>'+value(m.if)+'</td><td>'+value(m.ig)+'</td><td>'+value(m.ia)+'</td></tr>';
 return '<h3 style="margin:0 0 12px;color:#15354b">Indicadores de seguridad · '+year+'</h3>'+
 '<div class="kpis"><div class="card"><b>'+fmt(totalHht,0)+'</b><p>HHT acumuladas</p></div><div class="card"><b>'+(average===null?'—':fmt(average,1))+'</b><p>Trabajadores promedio</p></div><div class="card"><b>'+(maximum===null?'—':fmt(maximum,0))+'</b><p>Dotación máxima</p></div><div class="card"><b>'+value(ifv)+'</b><p>IF</p></div><div class="card"><b>'+value(ig)+'</b><p>IG</p></div><div class="card"><b>'+value(iav)+'</b><p>IA</p></div></div>'+
 '<div class="tablewrap" style="margin-top:14px"><table><thead><tr><th>Mes</th><th>Accidentes</th><th>Computables</th><th>Días perdidos</th><th>Promedio</th><th>Máximo</th><th>HHT</th><th>IF</th><th>IG</th><th>IA</th></tr></thead><tbody>'+monthly.map(row).join('')+'</tbody></table></div>'+
 '<p class="muted" style="margin-top:12px">Acumulado anual: '+computable+' accidentes computables · '+lost+' días perdidos · '+fmt(totalHht,0)+' HHT. IF '+value(ifv)+' · IG '+value(ig)+' · IA '+value(iav)+'. Dotación promedio sobre '+counts.length+' jornadas registradas. HHT = personal × horas por grupo. IF e IG por millón de HHT; IA = IF × IG / 1000. Sin HHT se muestra —.</p>'+
 '<p class="muted">Revisión SSOMA: la clasificación de accidentes computables y días perdidos debe validarse en los registros de eventos. Este panel no sustituye la investigación ni la aprobación del reporte oficial.</p>';
}
window.ssomaLiveHours=async function(db){
 const box=document.getElementById('ssomaLiveHours');if(!box||!db)return;
 const id=++request,year=new Date().getFullYear(),start=year+'-01-01',end=year+'-12-31';
 const [a,b]=await Promise.all([
 db.from('ssoma_daily_hours').select('work_date,contractor_id,staff_count,operative_count,staff_hours,operative_hours').gte('work_date',start).lte('work_date',end).limit(10000),
 db.from('ssoma_events').select('event_date,event_type,severity,days_lost').gte('event_date',start).lte('event_date',end).limit(10000)
 ]);
 if(id!==request||!box.isConnected)return;
 if(a.error||b.error){box.textContent='No fue posible actualizar los indicadores: '+(a.error?.message||b.error?.message);return}
 box.innerHTML=render(compute(a.data||[],b.data||[],year),year);
 if((a.data||[]).length===10000||(b.data||[]).length===10000)box.insertAdjacentHTML('beforeend','<p style="color:#b42338">Advertencia: límite de 10 000 registros alcanzado; revisar paginación.</p>');
};
})();