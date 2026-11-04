'use strict';
window.SSOMAQRDetails={
 async render({db,personId,container,escapeHtml}){
  if(!db||!personId||!container)return;
  const keys=[['EMO','EMO'],['SCTR_SALUD','SCTR Salud'],['SCTR_PENSION','SCTR Pensión']];
  const [docs,exceptions]=await Promise.all([
   db.from('sst_worker_documents').select('document_type,expiry_date,fitness_status').eq('person_id',personId),
   db.from('ssoma_document_exceptions').select('document_type,expires_on,revoked_at').eq('person_id',personId)
  ]);
  if(docs.error||exceptions.error){container.textContent='No se pudo verificar el detalle documental.';return}
  const today=new Date().toLocaleDateString('en-CA',{timeZone:'America/Lima'});
  const rows=keys.map(([key,label])=>{
   const d=(docs.data||[]).find(x=>x.document_type===key);
   const ex=(exceptions.data||[]).filter(x=>x.document_type===key&&!x.revoked_at&&x.expires_on>=today).sort((a,b)=>a.expires_on.localeCompare(b.expires_on))[0];
   const ok=!!(d?.expiry_date&&d.expiry_date>=today&&(key!=='EMO'||d.fitness_status==='APTO'));
   const state=ok?'VIGENTE':ex?'EXCEPCIÓN ADMINISTRATIVA':'PENDIENTE / NO CONFORME';
   const date=ok?d.expiry_date:ex?ex.expires_on:d?.expiry_date||'Sin registro';
   return '<div style="display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid #e2e8f0"><b>'+escapeHtml(label)+'</b><span style="text-align:right;color:'+(ok?'#087d71':'#9a6500')+'">'+escapeHtml(state)+'<br><small>'+escapeHtml(date)+'</small></span></div>';
  }).join('');
  container.innerHTML='<section style="text-align:left;margin-top:18px;padding:14px;border:1px solid #dbe5ef;border-radius:12px"><b>Vigencias y excepciones documentales</b>'+rows+'<p style="font-size:11px;color:#64748b">Las excepciones administrativas no sustituyen aptitud médica, cobertura de seguro ni autorización para trabajar.</p></section>';
 }
};