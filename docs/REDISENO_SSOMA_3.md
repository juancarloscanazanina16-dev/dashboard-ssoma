# SSOMA CONTROL 3.0 — Plan de rediseño seguro

Rama: redesign/ssoma-control-3-ux. No desplegar en main sin validación.

## Objetivo
Interfaz unificada y amigable, manteniendo autenticación, datos Supabase, roles, proyectos y registros.

## Navegación propuesta
1. Inicio: dashboard, alertas, búsqueda global, acciones rápidas.
2. Personas y empresas: contratistas, trabajadores, vigencias, habilitaciones, QR.
3. Operaciones SSOMA: ATS, PETAR, inspecciones, hallazgos, accidentes.
4. Formación: cronograma, inducciones, charlas, asistencias, formularios QR.
5. Recursos y documentos: EPP/EPC, Kardex, expedientes, gestión documental.
6. Inteligencia e informes: indicadores, exportaciones, reportes.

## Reglas de migración
- No eliminar ni modificar tablas ni registros existentes.
- No cambiar credenciales ni configuración de Supabase.
- Mantener aislamiento por proyecto y políticas RLS.
- Mantener permisos por rol y lectura exclusiva para personal autorizado.
- Conservar funciones existentes mediante rutas de compatibilidad.
- Verificar sesión, ingreso, lectura, edición y exportaciones antes de integrar a main.

## Etapas
1. Inventario de pantallas, handlers y consultas.
2. Crear design tokens y shell responsive en archivos separados.
3. Implementar navegación agrupada con compatibilidad de rutas.
4. Añadir búsqueda y acciones rápidas con permisos.
5. Crear fichas 360 y alertas.
6. Pruebas de regresión, accesibilidad y despliegue controlado.
