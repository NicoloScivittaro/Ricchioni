import type { PlayerInput } from '../network/PlayerInput';

/**
 * Adapter di movimento CONDIVISO per i minigiochi 3D (arena, dodgeball, calcio).
 *
 * Il joystick virtuale produce:
 *   moveX ∈ [-1,1]  (destra = +, sinistra = -)
 *   moveY ∈ [-1,1]  (giù = +, su = -)   [convenzione clientY: su è negativo]
 *
 * Qui vengono mappati nel mondo 3D (piano X/Z) in modo coerente:
 *   moveX → worldX   (asse laterale, nessun segno cambiato)
 *   moveY → worldZ   (avanti/indietro) con UN solo cambio di segno:
 *                    su (moveY<0) → +Z = lontano dalla camera.
 *
 * La camera condivisa (ArenaCamera, alpha = -π/2) sta a -Z e guarda +Z, quindi:
 *   +X = destra schermo, +Z = lontano/su, -Z = vicino/giù.
 *
 * Regola: NON scambiare gli assi (mai worldX = moveY). Eventuali modificatori
 * (es. "controlli invertiti") invertono entrambi gli assi DOPO questa mappatura.
 */
export function readMove(input: PlayerInput): { x: number; z: number } {
  return { x: input.axis('move').x, z: -input.axis('move').y };
}
