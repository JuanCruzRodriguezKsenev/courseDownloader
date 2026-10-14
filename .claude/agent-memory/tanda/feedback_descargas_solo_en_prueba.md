---
name: descargas-solo-en-carpeta-de-prueba
description: Toda descarga de verificación va a una carpeta de prueba (backend con HOME=home-prueba), nunca a la Bóveda real de Juan
metadata:
  type: feedback
---

Si una verificación baja archivos, el backend tiene que escribir en una carpeta de prueba, jamás en `~/Boveda/Areas/Facultad` real.

**Why:** Juan lo pidió explícito (2026-10-14) al verificar IDEAS: el puerto 3001 lo tenía su backend real y bajar habría ensuciado su Bóveda.

**How to apply:** antes de lanzar a `verificador` con casillas de descarga, comprobar `ss -ltnp | grep 3001` y el `HOME` del proceso; si es el real, pedirle a Juan que lo baje, levantar `HOME=~/.local/share/courseDownloader/home-prueba bun backend/server.js` y, al terminar, bajar el de prueba y avisar para que levante el suyo. Decirle al `verificador` que lo confirme y que borre lo bajado sólo dentro de `home-prueba`. `backend/config_usuario.json` (gitignorado) fija `rutaRaiz` en `~/Descargas/verificacion-b`.
