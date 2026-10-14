# Voce del Narratore Bastardo

Testi originali di PARTY GAME. Clip generate offline il 14 ottobre 2026 con Kokoro ONNX, voce italiana maschile `im_nicola`; montaggio/normalizzazione FFmpeg. Nessun campione o imitazione di personaggi famosi.

- Runtime [kokoro-onnx, thewh1teagle](https://github.com/thewh1teagle/kokoro-onnx): [licenza MIT](https://github.com/thewh1teagle/kokoro-onnx/blob/main/LICENSE).
- Modello [Kokoro-82M, hexgrad](https://huggingface.co/hexgrad/Kokoro-82M): licenza Apache 2.0 dichiarata nella scheda ufficiale e nel repository ONNX.
- [Voci e lingue ufficiali](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md); [esempio italiano ONNX](https://github.com/thewh1teagle/kokoro-onnx/blob/main/examples/italian.py).

Questa cartella distribuisce i file vocali OGG e relativi metadati. Il modello, i pesi vocali, il runtime Python e FFmpeg non sono incorporati nel gioco: sono strumenti usati soltanto in generazione. Per rigenerare usare `scripts/generate-narrator-audio.py` e la propria cartella locale di modelli mediante `NARRATOR_MODEL_DIR`.

Profilo radio originale: pitch leggermente abbassato, filtro passa alto, normalizzazione e velocità diversa per rullo/risultati/annunci. L'accento e l'espressività sono quelli di una voce TTS italiana con testo romanesco; non equivale a un doppiatore romano. Non sono state simulate né dichiarate registrazioni umane di risate o urla.
