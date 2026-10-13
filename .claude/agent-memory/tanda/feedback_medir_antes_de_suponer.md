---
name: medir-antes-de-suponer
description: Si hay datos reales a mano (archivos bajados, índice de prueba, sesión de Playwright abierta), usarlos antes de inferir o preguntar
metadata:
  type: feedback
---

Antes de razonar sobre cómo es un DOM o un archivo, mirar lo que ya tengo: los archivos bajados en el HOME de prueba,
su `.course-downloader.json`, y la sesión `playwright-cli -s=verif` (perfil `~/.local/share/courseDownloader/perfil-playwright`).
Comparar con el caso del repo que más se parece y predecir desde ahí.

**Why:** 2026-10-10, planificando el 34, el dueño me cortó dos veces: «analizá los casos y usalos como referencia para
predecir» y «ya descargaste archivos, además tenés playwright cli». Yo estaba haciendo greps sueltos y suponiendo el DOM.
Con 2 comandos (índice + DOM de /my/) salió la causa real de dos fallas.

**How to apply:** ante una incógnita de portal, primero `playwright-cli -s=verif run-code` o los archivos de prueba; después la decisión.
