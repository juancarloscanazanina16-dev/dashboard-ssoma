(function(){
'use strict';
let run=0;
window.ssomaLiveHours=async function(db){
 const box=document.getElementById('ssomaLiveHours');if(!box||!db)return;
 const token=++run,year=new Date().getFullYear();
 const {data,error}=await db.from('ssoma_daily_hours').select('work_date,contractor_id,staff_count,operative_count,staff_hours,operative_hours').gte('work_date',year+'-01-01').lte('work_date',year+'-12-31').limit(10000);
 if(token!==run||!box.isConnected)return;
 if(error){box.textContent='No se pudieron consultar las HHT: '+error.message;return}
 const rows=data||[],total=rows.reduce((n,r)=>n+Number(r.staff_hours||0)+Number(r.operative_hours||0),0);
 const days=new Map();
 rows.forEach(r=>{const x=days.get(r.work_date)||0;days.set(r.work_date,x+Number(r.staff_count||0)+Number(r.operative_count||0))});
 const counts=[...days.values()],peak=counts.length?Math.max(...counts):0,average=counts.length?counts.reduce((a,b)=>a+b,0)/counts.length:null;
 const f=n=>new Intl.NumberFormat('es-PE',{maximumFractionDigits:2}).format(n);
 box.innerHTML='<h3 style="margin:0 0 12px;color:#15354b">Horas-hombre y dotación · '+year+'</h3><div class="kpis"><div class="card"><b>'+f(total)+'</b><p>HHT acumuladas</p></div><div class="card"><b>'+(average===null?'—':f(average))+'</b><p>Trabajadores promedio por día registrado</p></div><div class="card"><b>'+f(peak)+'</b><p>Dotación máxima diaria</p></div></div><p class="muted">Fuente: registros diarios de HHT. Dotación promedio calculada sobre '+days.size+' fecha(s) registrada(s). No representa trabajadores únicos. HHT según horas registradas, no estimadas.</p>';
};
})();