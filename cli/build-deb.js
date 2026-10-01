import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const manifest = JSON.parse(fs.readFileSync(path.join(here, 'package.json'), 'utf8'))
const version = process.argv[2] || manifest.version
const name = manifest.name

const release = path.join(here, 'release')
const root = path.join(release, `${name}_${version}_all`)
const library = path.join(root, 'usr', 'lib', name)
const binary = path.join(root, 'usr', 'bin')
const docs = path.join(root, 'usr', 'share', 'doc', name)

fs.rmSync(release, { recursive: true, force: true })
for (const directory of [path.join(root, 'DEBIAN'), library, binary, docs]) {
	fs.mkdirSync(directory, { recursive: true })
}

fs.cpSync(path.join(here, 'src'), path.join(library, 'src'), { recursive: true })
fs.writeFileSync(path.join(library, 'package.json'), `${JSON.stringify({ ...manifest, version }, null, 2)}\n`)
fs.copyFileSync(path.join(here, '..', 'LICENSE'), path.join(docs, 'copyright'))

const launcher = path.join(binary, name)
fs.writeFileSync(launcher, `#!/bin/sh\nexec node /usr/lib/${name}/src/index.js "$@"\n`)

const normalize = (target) => {
	const directory = fs.statSync(target).isDirectory()
	fs.chmodSync(target, directory ? 0o755 : 0o644)
	if (directory) for (const entry of fs.readdirSync(target)) normalize(path.join(target, entry))
}
normalize(root)
fs.chmodSync(launcher, 0o755)
fs.chmodSync(path.join(library, 'src', 'index.js'), 0o755)

fs.writeFileSync(path.join(root, 'DEBIAN', 'control'), [
	`Package: ${name}`,
	`Version: ${version}`,
	'Architecture: all',
	'Maintainer: Aut0iq <Aut0iq@users.noreply.github.com>',
	'Depends: nodejs (>= 18), mpv',
	'Section: sound',
	'Priority: optional',
	`Homepage: ${manifest.homepage}`,
	`Description: ${manifest.description}`,
	' Terminal music player for Navidrome and other Subsonic servers.',
	' Browse artists, albums and playlists, search, manage the queue',
	' and play an endless random mix. Audio is played through mpv.',
	'',
].join('\n'))

execFileSync('dpkg-deb', ['--build', '--root-owner-group', root, path.join(release, `${name}_${version}_all.deb`)], { stdio: 'inherit' })

const bundle = path.join(release, `${name}-${version}`)
fs.cpSync(library, bundle, { recursive: true })
fs.copyFileSync(path.join(here, '..', 'LICENSE'), path.join(bundle, 'LICENSE'))
execFileSync('tar', ['-czf', `${name}-${version}.tar.gz`, `${name}-${version}`], { cwd: release, stdio: 'inherit' })

fs.rmSync(root, { recursive: true, force: true })
fs.rmSync(bundle, { recursive: true, force: true })
console.log(fs.readdirSync(release).join('\n'))
