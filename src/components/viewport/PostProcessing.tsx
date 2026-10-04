import { EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing'
import { ToneMappingMode } from 'postprocessing'
import { useSplatStore } from '../../store/splatStore'

// Phase 1 stack: minimal — ACES tone mapping + subtle vignette.
// Phase 2 will add SSAO, bloom, depth of field, color grading.
// Phase 3 adds the AI-enhanced render pass.

export function PostProcessing() {
  // Splat colours are already display-ready; ACES on top washes them out.
  const hasSplat = useSplatStore((s) => s.file !== null)
  return (
    // The composer renders to its own buffer, bypassing the Canvas MSAA, so it
    // needs multisampling here or High mode would alias. Only runs in High mode.
    <EffectComposer multisampling={4}>
      {hasSplat ? <></> : <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />}
      <Vignette darkness={0.35} offset={0.4} />
    </EffectComposer>
  )
}
