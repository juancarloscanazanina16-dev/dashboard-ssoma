// Configuración pública para el cliente web. Nunca incluir claves secretas.
window.SSOMA_CONFIG = {
  supabaseUrl: "https://anniokkcnvwnupwvltan.supabase.co",
  supabaseAnonKey: "sb_publishable_Yucbky5Rw0kQkkXlHXHpgg_oeSSMr_T"
};

// Inicializador independiente de gestión de personal.
(function(){
  if(window.__ssomaPersonnelLifecycleBoot)return;
  window.__ssomaPersonnelLifecycleBoot=true;
  function start(){
    if(!document.querySelector('link[data-ssoma-personnel-lifecycle]')){
      const css=document.createElement('link');css.rel='stylesheet';css.href='ssoma-personnel-lifecycle.css?v=20261104c';css.dataset.ssomaPersonnelLifecycle='1';document.head.appendChild(css);
    }
    if(!document.querySelector('script[data-ssoma-personnel-lifecycle]')){
      const js=document.createElement('script');js.src='ssoma-personnel-lifecycle.js?v=20261104c';js.dataset.ssomaPersonnelLifecycle='1';document.head.appendChild(js);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
