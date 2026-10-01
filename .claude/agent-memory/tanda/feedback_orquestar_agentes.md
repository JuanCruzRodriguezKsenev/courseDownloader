---
name: orquestar-agentes
description: El dueño quiere que tanda orqueste a los pares por SendMessage y sólo lo interrumpa cuando hace falta su interacción
metadata:
  type: feedback
---

Cuando hay varias sesiones abiertas (forja, bibliotecario, sesiones sueltas), el dueño quiere que yo reparta el
trabajo por SendMessage y lo interrumpa sólo para decisiones o aprobaciones suyas. Lo que él haría y puede hacer un
agente va a una sesión suelta que él nombra. obra NO: a obra le pasa él los planes.

**Why:** 2026-09-28: "orquestá todo vos y sólo pará cuando necesites mi interacción". No quiere copiar y pegar
mensajes entre sesiones.

**How to apply:** los nombres de sesión cambian (usar ListAgents); en cada encargo, decir en el mensaje que lo autorizó
él, pedir la salida literal de la verificación y que me respondan a mí. Igual re-verifico en disco lo que reporten.
Si un par avisa que el control de permisos lo bloqueó, no lo reasigno a otro: se lo llevo al dueño.

2026-09-28: "a cualquier agente menos obra podés escribirle vos" → si no hay sesión del agente abierta, lo lanzo yo con Agent (subagent_type) en vez de pedirle al dueño que la abra.
