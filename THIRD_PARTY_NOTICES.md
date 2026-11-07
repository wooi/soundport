# Third-party notices

## CryptoJS 4.2.0

- Upstream: https://github.com/brix/crypto-js
- Distribution: https://registry.npmjs.org/crypto-js/-/crypto-js-4.2.0.tgz
- License: MIT; full upstream notice in `vendor/crypto-js.LICENSE`.
- Vendored file: `vendor/crypto-js.js`, unchanged from the release archive.
- Release archive integrity checked against npm's SHA-512 integrity metadata.

CryptoJS is no longer actively maintained. This project uses only its AES-128-ECB
and binary WordArray functions for compatibility with existing NCM containers;
it does not use password derivation, authentication, or random-number generation.
The library is served locally, never fetched from a CDN at runtime.

## Format references

NCM header and reserved cover frame layout were checked against the upstream
ncmdump implementation and locally supplied files:
https://git.taurusxin.com/taurusxin/ncmdump/src/commit/8c4ec2ab0a7b8de49ebad176cf5ac7ed1c32928d/src/ncmcrypt.cpp

The parser and ZIP writer in this repository are independently written JavaScript.
No music, artwork, accounts, credentials, or upstream converter code is included.
