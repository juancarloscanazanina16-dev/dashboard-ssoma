/* SSOMA CONTROL 3.0 - safe client-only navigation shell */
(()=>{'use strict';
const items=[
 ['personnel','👷','Personal y habilitaciones','Ficha de trabajadores, DNI y requisitos de ingreso'],
 ['contractors','🏢','Contratistas y dossier','Empresas, expedientes y cumplimiento documental'],
 ['dailyControls','📋','Control operativo','ATS, PETAR y listas de verificación'],
 ['formacion','🎓','Formación SSOMA','Charlas, capacitaciones, inducciones y asistencia'],
 ['inspections','🔎','Inspecciones y hallazgos','Seguimiento preventivo y acciones correctivas'],
 ['reports','📊','Informes e indicadores','Reportes y resultados de gestión']
];
function init(){
 const app=document.getElementById('app'),nav=document.getElementById('nav'),content=document.getElementById('content');
 if(!app||!nav||!content||document.getElementById('ssomaUxSearch'))return;
 const wrap=document.createElement('div');wrap.className='ssoma-ux-search';
 const label=document.createElement('label');label.htmlFor='ssomaUxSearch';label.textContent='Buscar módulos';
 const input=document.createElement('input');input.id='ssomaUxSearch';input.type='search';input.placeholder='DNI, EPP, ATS, SCTR…';
 const results=document.createElement('div');results.className='ssoma-ux-search-results';
 wrap.append(label,input,results);nav.parentElement.insertBefore(wrap,nav);
 const homeButton=document.createElement('button');homeButton.type='button';homeButton.className='ssoma-ux-home-link';homeButton.textContent='⌂  Nuevo inicio SSOMA 3.0';nav.parentElement.insertBefore(homeButton,nav);
 const home=document.createElement('section');home.className='ssoma-ux-home hidden';home.id='ssomaUxHome';home.setAttribute('aria-label','Centro de control SSOMA 3.0');
 content.parentElement.insertBefore(home,content);
 let showing=false;
 const visible=(page)=>{const b=[...nav.querySelectorAll('button[data-page]')].find(x=>x.dataset.page===page);return b&&!b.classList.contains('hidden')&&!b.closest('.hidden')?b:null};
 function go(page){const b=visible(page);if(!b)return;hide();b.click()}
 function el(tag,cls,txt){const n=document.createElement(tag);if(cls)n.className=cls;if(txt)n.textContent=txt;return n}
 function section(title){const d=el('div','ssoma-ux-section');d.append(el('h3','',title));home.append(d)}
 function addButton(parent,label,page,cls,description,symbol){const b=el('button',cls);b.type='button';if(symbol)b.append(el('span','symbol',symbol));b.append(el('strong','',label));if(description)b.append(el('small','',description));b.addEventListener('click',()=>go(page));parent.append(b)}
 function renderHome(){
 home.replaceChildren();
 const hero=el('div','ssoma-ux-hero'),left=el('div');left.append(el('div','ssoma-ux-eyebrow','Centro de control · SSOMA CONTROL 3.0'),el('h2','','Tu obra, bajo control.'),el('p','','Accede a los procesos principales desde un solo lugar. Los registros y permisos siguen gestionándose en los módulos originales.'));
 hero.append(left,el('div','ssoma-ux-hero-mark','◈'));home.append(hero);
 section('Acciones rápidas');
 const quick=el('div','ssoma-ux-quick');
 for(const [name,page] of [['+ Registrar trabajador','personnel'],['↗ Revisar contratista','contractors'],['✓ Nueva inspección','inspections'],['▤ Formación SSOMA','formacion'],['▥ Ver informes','reports']])if(visible(page))addButton(quick,name,page,'');
 home.append(quick);section('Áreas de trabajo');
 const grid=el('div','ssoma-ux-grid');for(const [page,symbol,name,desc] of items)if(visible(page))addButton(grid,name,page,'ssoma-ux-tile',desc,symbol);
 home.append(grid);home.append(el('p','ssoma-ux-note','Vista de navegación. Los indicadores y alertas se consultan en el Panel principal hasta completar su integración.'));
 }
 function show(){if(app.classList.contains('hidden'))return;renderHome();showing=true;home.classList.remove('hidden');content.classList.add('hidden');homeButton.setAttribute('aria-current','page');const title=document.getElementById('pageTitle');if(title)title.textContent='Centro de control SSOMA 3.0'}
 function hide(){if(!showing)return;showing=false;home.classList.add('hidden');content.classList.remove('hidden');homeButton.removeAttribute('aria-current')}
 homeButton.addEventListener('click',show);
 nav.addEventListener('click',e=>{if(e.target.closest('button[data-page]'))hide()},true);
 const normalize=s=>(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const alias={personnel:'dni trabajador epp',contractors:'empresa dossier',validity:'emo sctr dni',formacion:'charla capacitacion qr asistencia',dailyControls:'ats petar checklist',inspections:'hallazgo riesgo',reports:'informes',masterDocs:'documentos formatos',dashboard:'inicio panel'};
 input.addEventListener('input',()=>{results.replaceChildren();const q=normalize(input.value.trim());if(!q)return;const matches=[...nav.querySelectorAll('button[data-page]')].filter(b=>visible(b.dataset.page)&&normalize(b.textContent+' '+(alias[b.dataset.page]||'')).includes(q)).slice(0,9);for(const b of matches){const v=el('button','',b.textContent.trim());v.type='button';v.addEventListener('click',()=>{go(b.dataset.page);input.value='';results.replaceChildren()});results.append(v)}if(!matches.length)results.append(el('div','empty-search','Sin coincidencias'))});
 input.addEventListener('keydown',e=>{if(e.key==='Enter'){const b=results.querySelector('button');if(b){e.preventDefault();b.click()}}if(e.key==='Escape'){input.value='';results.replaceChildren()}});
 const observer=new MutationObserver(()=>{if(app.classList.contains('hidden'))hide()});observer.observe(app,{attributes:true,attributeFilter:['class']});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
