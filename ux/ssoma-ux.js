/* SSOMA CONTROL 3.0 | Búsqueda de navegación, sin tocar autenticación ni datos */
(()=>{'use strict';
function init(){
 const nav=document.getElementById('nav');if(!nav||document.getElementById('ssomaUxSearch'))return;
 const wrap=document.createElement('div');wrap.className='ssoma-ux-search';
 const label=document.createElement('label');label.htmlFor='ssomaUxSearch';label.textContent='Acceso rápido a módulos';
 const input=document.createElement('input');input.id='ssomaUxSearch';input.type='search';input.placeholder='Buscar módulo…';input.autocomplete='off';
 const results=document.createElement('div');results.className='ssoma-ux-search-results';results.setAttribute('role','listbox');
 wrap.append(label,input,results);nav.parentElement.insertBefore(wrap,nav);
 const aliases={personnel:'dni trabajador personal ficha',contractors:'empresa subcontratista dossier',validity:'emo sctr dni vigencia',formacion:'charla capacitación qr asistencia',trainings:'inducción',retrainings:'reinducción',inspections:'hallazgo condición insegura',dailyControls:'ats petar checklist permiso',reports:'informes reporte semanal mensual',masterDocs:'documentos formatos',executive:'accidentes incidentes indicadores',dashboard:'panel indicadores inicio',portfolio:'proyectos',archive:'expedientes'};
 const normalize=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 function search(){
  results.replaceChildren();const q=normalize(input.value.trim());if(!q)return;
  const items=[...nav.querySelectorAll('button[data-page]')].filter(b=>!b.classList.contains('hidden')&&!b.closest('.hidden')).filter(b=>normalize(b.textContent+' '+(aliases[b.dataset.page]||'')).includes(q)).slice(0,8);
  if(!items.length){const p=document.createElement('div');p.className='empty-search';p.textContent='No se encontró un módulo';results.append(p);return}
  for(const b of items){const btn=document.createElement('button');btn.type='button';btn.textContent=b.textContent.trim();btn.addEventListener('click',()=>{if(b.closest('.ssoma-nav-group')){const g=b.closest('.ssoma-nav-group');g.classList.add('open');g.querySelector('.ssoma-nav-heading')?.setAttribute('aria-expanded','true')}b.click();input.value='';results.replaceChildren()});results.append(btn)}
 }
 input.addEventListener('input',search);input.addEventListener('keydown',e=>{if(e.key==='Escape'){input.value='';results.replaceChildren()}if(e.key==='Enter'){const first=results.querySelector('button');if(first){e.preventDefault();first.click()}}});
 const observer=new MutationObserver(()=>{if(input.value)search()});observer.observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
