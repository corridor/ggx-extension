"""Verify the shipped VSIX has only explicitly reviewed, dependency-free contents."""

import json
from pathlib import Path
from zipfile import ZipFile


manifest = json.loads(Path("package.json").read_text())
artifact = Path(f"{manifest['name']}-{manifest['version']}.vsix")
expected = {
    "[Content_Types].xml",
    "extension.vsixmanifest",
    "extension/package.json",
    "extension/readme.md",
    "extension/changelog.md",
    "extension/LICENSE.txt",
    "extension/PRIVACY.md",
    "extension/media/icon.png",
    "extension/out/endpoint.js",
    "extension/out/provider.js",
    "extension/out/extension.js",
}
with ZipFile(artifact) as archive:
    names = set(archive.namelist())
    # vsce can normalize document casing across versions; compare case-insensitively.
    assert {name.lower() for name in names} == {name.lower() for name in expected}, names
    packaged = json.loads(archive.read("extension/package.json"))
    assert packaged["contributes"]["configuration"]["properties"]["ggxMcp.url"]["default"] == ""
    assert not packaged.get("dependencies")
print(f"Verified {artifact}: {len(names)} allowlisted entries, no runtime dependencies or default URL.")
