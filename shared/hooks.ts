/**
 * Catalogo centrale degli hook.
 * Un minigioco DICHIARA quali hook sa interpretare; un personaggio MAPPA la
 * propria identità su questi hook. Parlano solo tramite questi token.
 */
export const HOOKS = {
  quiz_remove_answer: 'quiz.remove_answer',
  quiz_extra_time: 'quiz.extra_time',
  quiz_peek: 'quiz.peek',
  race_reveal_obstacle: 'race.reveal_obstacle',
  race_quick_recover: 'race.quick_recover',
  reaction_one_free_miss: 'reaction.one_free_miss',
  memory_freeze: 'memory.freeze',
  memory_replay: 'memory.replay',
  arena_knockback_resist: 'arena.knockback_resist',
  arena_recover_grab: 'arena.recover_grab',
  luck_reroll: 'luck.reroll',
  timing_stability: 'timing.stability',
  puzzle_one_hint: 'puzzle.one_hint',
  generic_undo_one_error: 'generic.undo_one_error'
} as const;

export type HookKey = keyof typeof HOOKS;
export type HookId = (typeof HOOKS)[HookKey];
