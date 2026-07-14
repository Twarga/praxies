# Releasing Praxis for Linux

Linux releases are built by `.github/workflows/release-linux.yml` on an explicit
workflow dispatch or a `v*` tag. A tag build publishes the AppImage, SHA-256
file, standalone installer, optional minisign signature, and `latest-linux.json`
to the matching GitHub release.

## Signing setup

Create a minisign key outside the repository and store the base64-encoded
secret-key file as the GitHub Actions secret `PRAXIS_MINISIGN_SECRET_KEY`.
Keep the public key in the website or installer distribution channel. The
workflow never writes the secret key into a release artifact.

## Release procedure

1. Ensure `frontend/package.json` contains the intended version.
2. Run `./scripts/release-linux.sh` locally and verify the AppImage, checksum, and `latest-linux.json` manifest.
3. Create and push the matching tag, such as `v0.2.0`.
4. Confirm the Linux release workflow passes.
5. Download the release assets and verify the checksum and minisign signature.

The stable machine-readable URL for a version is:

`https://github.com/Twarga/praxies/releases/download/vVERSION/latest-linux.json`

Local release builds may override asset URLs with
`PRAXIS_RELEASE_BASE_URL`. Signing is optional locally and enabled by setting
`PRAXIS_MINISIGN_SECRET_KEY` to the secret-key file path.

## One-command installation

End users can install the newest Linux release with:

```bash
curl -fsSL https://raw.githubusercontent.com/Twarga/praxies/main/scripts/install.sh | bash
```

The installer fetches the release manifest, downloads the matching AppImage,
verifies its SHA-256 checksum, creates a `praxis` launcher and desktop entry,
and never touches journals, credentials, or model caches when uninstalling.
