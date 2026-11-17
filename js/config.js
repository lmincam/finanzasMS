'use strict';
/* =====================================================================
   CONFIGURACIÓN
   ---------------------------------------------------------------------
   Versión de la app y conexión con Supabase.
   Depende de: nada (se carga el primero)
   ===================================================================== */

/** Versión de la app. Al publicar una versión nueva, súbela aquí Y en los ?v= de index.html. */
const APP_VERSION = '5.20.0';

/* Opción A: pega aquí tu Project URL y tu clave anon/publishable.
   Opción B (recomendada si el repositorio de GitHub es público):
   déjalas vacías y configúralas en la pestaña ⚙️ Ajustes; se guardan
   solo en el localStorage de cada dispositivo. */
const SUPABASE_URL      = '';   // ej: 'https://abcdefghijk.supabase.co'
const SUPABASE_ANON_KEY = '';   // ej: 'eyJhbGciOi...' o 'sb_publishable_...'
