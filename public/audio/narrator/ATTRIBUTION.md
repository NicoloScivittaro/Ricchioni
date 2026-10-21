# Voce del Narratore Bastardo

Testi originali di PARTY GAME. Profilo vocale aggiornato il 21 ottobre 2026 con Kokoro ONNX, voce italiana maschile `im_nicola`; montaggio/normalizzazione FFmpeg. Nessun campione o imitazione di personaggi famosi.

- Runtime [kokoro-onnx, thewh1teagle](https://github.com/thewh1teagle/kokoro-onnx): [licenza MIT](https://github.com/thewh1teagle/kokoro-onnx/blob/main/LICENSE).
- Modello [Kokoro-82M, hexgrad](https://huggingface.co/hexgrad/Kokoro-82M): licenza Apache 2.0 dichiarata nella scheda ufficiale e nel repository ONNX.
- [Voci e lingue ufficiali](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md); [esempio italiano ONNX](https://github.com/thewh1teagle/kokoro-onnx/blob/main/examples/italian.py).

Questa cartella distribuisce i file vocali OGG e relativi metadati. Il modello, i pesi vocali, il runtime Python e FFmpeg non sono incorporati nel gioco: sono strumenti usati soltanto in generazione. Per rigenerare usare `scripts/generate-narrator-audio.py` e la propria cartella locale di modelli mediante `NARRATOR_MODEL_DIR`.

Profilo `natural-sarcasm-v2`: timbro non trasposto e nessuna accelerazione applicata al file finito; velocità di sintesi vicina al parlato normale, pause differenziate e testo fonetico senza titoli interamente maiuscoli. Filtro passa alto, lieve presenza sulle consonanti, compressione moderata e normalizzazione. La cattiveria deriva dalle battute e dalla cadenza; l'accento e l'espressività restano quelli di una voce TTS italiana con testo romanesco. Non equivale a un doppiatore romano. Non sono state simulate né dichiarate registrazioni umane di risate o urla.
