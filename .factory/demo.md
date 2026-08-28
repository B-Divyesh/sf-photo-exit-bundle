# Demo sandbox

Open `/demo` (or `/?demo=1`) to load a bundled family-weekend Takeout sample. It contains two photos, Google JSON sidecars, a Motion Photo companion, and one unknown file for review.

The demo creates in-memory files only. It sets the `sessionStorage` key `demo:photo-exit-bundle:active`, does not open the normal IndexedDB run-history database, does not read or write real run history or licenses, and never uses selected files. **Reset demo** discards and recreates the seeded collection. **Start for real** clears the demo namespace and returns to the empty real-file picker.
