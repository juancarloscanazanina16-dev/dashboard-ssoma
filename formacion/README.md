# Módulo Formación SSOMA — rama de desarrollo

## Alcance
Actividades: charla (10 min), capacitación (60 min), inducción (120 min), reinducción (30 min), difusión (30 min), simulacro (60 min). Duración real editable y auditada.

## Flujo
Cronograma → ejecución → asistencia individual (DNI, empresa, cargo y firma) → fotografías → validación → consolidado semanal/mensual.

## Cálculo
HH de formación = suma de asistentes presentes por actividad × duración real en horas. Las participaciones no equivalen a trabajadores únicos. No sumar HH de formación a HHT de accidentabilidad.

## Seguridad e integración
El SQL es aditivo, sin modificar tablas existentes. RLS activado sin políticas permisivas. No ejecutar en producción hasta revisar roles actuales y modelo de proyectos. Fotos y firmas deben almacenarse en bucket privado, no en GitHub Pages. No publicar datos personales en repositorio.

## Estado
Primera fase: esquema propuesto en rama feature/formacion-ssoma. Pendiente: auditar la navegación, autenticación, tablas existentes y conectar el módulo a la interfaz e informes. No se ha desplegado en producción.
