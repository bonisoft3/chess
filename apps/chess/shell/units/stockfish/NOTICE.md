# Stockfish, vendored

`stockfish-18-lite-single.js` and `stockfish-18-lite-single.wasm` in this
directory are third-party object code, copied byte for byte and never
re-minified or re-bundled. `unit.js` beside them is this app's own and is not
covered by anything below.

## Coordinates

| | |
| --- | --- |
| npm package | `stockfish@18.0.8` |
| tarball | `https://registry.npmjs.org/stockfish/-/stockfish-18.0.8.tgz` |
| tarball sha256 | `bf7f06511204543b82bd77db2c6fa61c0de94678ee20c1a8d0962309095d2480` |
| `stockfish-18-lite-single.js` sha256 | `5243fd9b276cab7dfe3ad1d43ab9ead73568fac76468c614242977a210c4a391` |
| `stockfish-18-lite-single.wasm` sha256 | `a8fbc05ec6920b56d7485826dcb02c5ffd2826bcbf751cf973046f237a9096f1` |
| evaluation net | `nn-9067e33176e`, by Linmiao Xu (linrock), linked into the `.wasm` |
| `LICENSE` sha256 | `3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986` |

Upstream: the engine is <https://github.com/official-stockfish/Stockfish> by
T. Romstad, M. Costalba, J. Kiiski, G. Linscott and contributors; the WASM
build and its glue are <https://github.com/nmrugg/stockfish.js> by Nathan Rugg,
with Chess.com. Both are GPLv3.

## Reproducing these bytes

```
npm pack stockfish@18.0.8 && tar xzf stockfish-18.0.8.tgz package/bin/stockfish-18-lite-single.js package/bin/stockfish-18-lite-single.wasm
```

The `.js` carries its own copyright banner as its first bytes; that banner is
the notice GPLv3 §4 requires and re-minifying would delete it. The `.wasm`
carries no banner at all, which is why this file exists.

## The GPLv3 duties, and how they are discharged

Serving these files to a browser is conveying object code, and GPLv3 has no
network exception. The offer taken is **§6(d)**: `LICENSE` (the unmodified
GPLv3 text) and this file are served as statics from the same directory as the
binary, so `/shell/units/stockfish/LICENSE` and
`/shell/units/stockfish/NOTICE.md` are reachable beside
`/shell/units/stockfish/stockfish-18-lite-single.wasm` — which is what makes
"the same place" true.

**The corresponding source is `stockfish@18.0.8` as published, at the coordinates
and hashes above, and is available from those upstream repositories and from the
npm tarball named here at no charge for as long as this app serves the object
code.**

The rest of this tree is LGPL-3.0, and LGPL-3.0 → GPL-3.0 is a permitted
upgrade, so there is nothing further to resolve.
