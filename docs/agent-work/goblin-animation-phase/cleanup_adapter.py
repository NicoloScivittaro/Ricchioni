"""Remove the superseded single-run sampler after the 36-clip adapter was validated."""
import pathlib
p=pathlib.Path(__file__).resolve().parents[3]/'src/minigames/characters/goblinVisual.ts'
s=p.read_text(encoding='utf-8')
a=s.index('  /** Aggiorna la clip di locomozione.')
b=s.index('\n  dispose(): void {',a)
s=s[:a]+'''  /** Read-only gameplay state selects one authored pose. Engine groups never autoplay. */
  update(dt: number, pose: GoblinPoseState): void {
    if (this.state !== 'ready' || this.disposed) return;
    if (this.opts.seated) {
      if (!this.seatedApplied) this.applySeatedPose();
      return;
    }
    this.animator?.update(dt, pose);
    this.speedRatio = this.animator?.controller.last?.speed ?? 0;
    this.skeleton?.prepare();
  }
''' +s[b:]
a=s.index('  /** Fotogramma più "in piedi"')
b=s.index('  private hipsTrack(',a)
s=s[:a]+'''  /** glTF animates linked TransformNodes, not the Bone objects themselves. */
'''+s[b:]
s=s.replace('const CLIP_OFFSET_EPSILON = 0.02;','').replace('const IDLE_HOLD_FRACTION = 0.5;','')
s=s.replace('clip `run.001`) selezionabile','36 clip) selezionabile')
s=s.replace("- l'import è SOLO grafico: nessuna posizione, velocità, abilità, collider o hitbox del gioco viene letta/scritta;", "- l'import è SOLO grafico: legge stato e tempi, non scrive mai posizione, velocità, collider o hitbox;")
s=s.replace('Unica clip del GLB (Mixamo "run", 195 canali × 65 nodi, ~1,25 s).','Clip obbligatoria di locomozione (una delle 36 clip; 195 canali × 65 nodi).')
s=s.replace('Copia byte-per-byte del GLB originale (`green+goblin+3d+model.glb`)', 'Copia byte-per-byte del GLB animato (`green+goblin+3d+model (2).glb`)')
s=s.replace('Sotto questa soglia (unità modello) lo scostamento orizzontale della clip è considerato fisiologico.', 'Root translation is neutralized at pose evaluation, per instance.')
a=s.index('/**\n * Posa FERMA (nessuna clip di idle')
b=s.index('/** Oltre questo tempo',a)
s=s[:a]+s[b:]
s=s.replace('      this.idleApplied = false;\n','').replace('  private idleApplied = false;\n','')
a=s.index('        // 1) la traccia delle anche')
b=s.index('        this.animator = new GoblinRigAnimator',a)
s=s[:a]+'''        // Linked-node sampler owns locomotion/actions/reactions/results. Groups are immutable clip data.
        this.hipsTrack(run);
        this.holdFrame = 0;
'''+s[b:]
p.write_text(s,encoding='utf-8')
print('single-clip runtime removed; seated DEV experiment retained')
