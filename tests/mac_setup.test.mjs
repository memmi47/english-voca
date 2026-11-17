// Execute the real scripts in isolated homes. No real LaunchAgent or child record is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';

const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const scripts = ['install_mac.sh', 'uninstall_mac.sh', 'update_mac.sh'];
const serverLabel = 'com.english-voca.server', backupLabel = 'com.english-voca.backup';
const write = (p, text) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
const hash = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function tree(root) {
  if (!fs.existsSync(root)) return null;
  const result = {};
  const walk = (dir) => { for (const name of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, name), stat = fs.lstatSync(p), key = path.relative(root, p);
    if (stat.isSymbolicLink()) result[key] = ['link', fs.readlinkSync(p)];
    else if (stat.isDirectory()) { result[key] = ['dir']; walk(p); }
    else result[key] = [hash(p), stat.mtimeMs];
  } };
  walk(root); return result;
}
const launcher = String.raw`import os,sys,json,pathlib,plistlib
args=sys.argv[1:]; log=pathlib.Path(os.environ['MAC_FAKE_LOG']); state=pathlib.Path(os.environ['MAC_FAKE_STATE'])
with log.open('a') as out:out.write(json.dumps({'cmd':'launchctl','args':args})+'\n')
jobs=json.loads(state.read_text()) if state.exists() else {}
if args[0]=='print':
 label=args[-1].split('/')[-1]
 if label not in jobs:sys.exit(113)
 print('state = running');sys.exit(0)
if args[0]=='bootstrap':
 config=plistlib.loads(pathlib.Path(args[-1]).read_bytes());jobs[config['Label']]=args[-1]
elif args[0]=='bootout':
 config=plistlib.loads(pathlib.Path(args[-1]).read_bytes());jobs.pop(config['Label'],None)
elif args[0]=='kickstart':
 if args[-1].split('/')[-1] not in jobs:sys.exit(113)
else:raise AssertionError(args)
state.write_text(json.dumps(jobs))
`;
const fakeGit = String.raw`import os,sys,json,pathlib
args=sys.argv[1:];game=pathlib.Path(os.environ['MAC_FAKE_GAME']);data=pathlib.Path(os.environ['MAC_FAKE_DATA'])
assert args==['-C',str(game),'pull','--ff-only'],args
assert (game/'.git').is_dir()
copies=sorted((data/'before-update').iterdir());assert copies
latest=copies[-1];assert (latest/'p.son.json').read_bytes()==(data/'p.son.json').read_bytes()
assert not (latest/'before-update').exists(),'snapshots must not recursively copy older snapshots'
with pathlib.Path(os.environ['MAC_FAKE_LOG']).open('a') as out:out.write(json.dumps({'cmd':'git','args':args,'snapshot':str(latest)})+'\n')
if os.environ.get('MAC_FAKE_GIT_FAIL')=='1':print('synthetic pull failure',file=sys.stderr);sys.exit(7)
print('synthetic fast-forward pull')
`;
function fixture() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cards-mac-')));
  const f = { root, game: path.join(root, 'game & cards'), home: path.join(root, 'home & 가족'), bin: path.join(root, 'bin'), log: path.join(root, 'calls.jsonl'), state: path.join(root, 'jobs.json') };
  f.data = path.join(f.home, 'data & progress'); f.source = path.join(f.game, 'state-cards'); f.backup = path.join(root, 'private backup');
  f.agents = path.join(f.home, 'Library/LaunchAgents');
  fs.mkdirSync(path.join(f.game, 'tools'), { recursive: true }); fs.mkdirSync(path.join(f.backup, '.git'), { recursive: true });
  for (const script of scripts) fs.copyFileSync(path.join(repo, 'tools', script), path.join(f.game, 'tools', script));
  write(path.join(f.game, 'tools/serve_cards.py'), '# synthetic fixture; fake launchctl never starts a server\n');
  write(path.join(f.game, 'tools/backup_state.sh'), '# synthetic fixture; no backup is executed\n');
  write(path.join(f.source, 'p.son.json'), '{"rev":4,"data":{"v":3,"words":{"a":{"st":"done"}}}}\n');
  write(path.join(f.source, 'daily/p.son.2026-11-17.json'), 'daily copy\n');
  write(path.join(f.source, 'backup/p.son.00000003.json'), 'older version\n');
  write(path.join(f.backup, 'keep.txt'), 'existing private backup\n');
  const mock = (name, body) => { const p = path.join(f.bin, name); write(p, '#!/usr/bin/env python3\n' + body); fs.chmodSync(p, 0o755); };
  mock('uname', "print('Darwin')\n");
  mock('launchctl', launcher);
  mock('scutil', "print('Test-Mac')\n");
  mock('ifconfig', "print('lo0 en0 en1')\n");
  mock('ipconfig', "import sys\nprint({'en0':'192.168.1.20','en1':'192.168.1.21'}.get(sys.argv[-1],''))\n");
  mock('lsof', 'import sys\nsys.exit(1)\n');
  mock('curl', "import os,json,pathlib,sys\np=pathlib.Path(os.environ['MAC_FAKE_STATE'])\nsys.exit(7) if not p.exists() else None\nprint(json.dumps({'ok':True,'store':True}))\n");
  mock('git', fakeGit);
  f.env = { ...process.env, HOME: f.home, PATH: f.bin + path.delimiter + process.env.PATH, MAC_FAKE_LOG: f.log, MAC_FAKE_STATE: f.state, MAC_FAKE_GAME: f.game, MAC_FAKE_DATA: f.data };
  return f;
}
function call(f, script, args = [], extra = {}) {
  const result = spawnSync('bash', [path.join(f.game, 'tools', script), ...args], { env: { ...f.env, ...extra }, encoding: 'utf8', input: 'y\n', timeout: 30000 });
  assert.ifError(result.error); return { ...result, out: result.stdout + result.stderr };
}
const install = (f) => { const r = call(f, 'install_mac.sh', ['--data', f.data, '--backup-repo', f.backup]); assert.equal(r.status, 0, r.out); return r; };
const calls = (f) => fs.existsSync(f.log) ? fs.readFileSync(f.log, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
const plistPath = (f, label) => path.join(f.agents, label + '.plist');
const plist = (file) => JSON.parse(execFileSync('python3', ['-c', 'import plistlib,json,sys;print(json.dumps(plistlib.load(open(sys.argv[1],"rb"))))', file], { encoding: 'utf8' }));

test('MAC1: dry-run and declining confirmation create no files or agents', () => {
  const f = fixture(), before = tree(f.root);
  const r = call(f, 'install_mac.sh', ['--data', f.data, '--backup-repo', f.backup, '--dry-run']);
  assert.equal(r.status, 0, r.out); assert.match(r.out, /설치 계획/); assert.match(r.out, /21:07/);
  assert(r.out.includes(plistPath(f, backupLabel))); assert(r.out.includes(path.join(f.home, 'Library/Logs/english-voca-backup.log')));
  assert.deepEqual(tree(f.root), before); assert(!fs.existsSync(f.home)); assert.equal(calls(f).length, 0);
  const declined = spawnSync('bash', [path.join(f.game, 'tools/install_mac.sh'), '--data', f.data], { env: f.env, input: 'n\n', encoding: 'utf8' });
  assert.equal(declined.status, 0, declined.stderr); assert.deepEqual(tree(f.root), before);
});

test('MAC2: installation copies complete original records without changing them and handles spaced paths', () => {
  const f = fixture(), original = tree(f.source), privateBackup = tree(f.backup);
  const r = install(f);
  assert.deepEqual(tree(f.source), original); assert.deepEqual(tree(f.data), original); assert.deepEqual(tree(f.backup), privateBackup);
  assert.match(r.out, /Test-Mac\.local:8090/); assert.match(r.out, /192\.168\.1\.20:8090/); assert.match(r.out, /192\.168\.1\.21:8090/); assert.match(r.out, /\/api\/ping: OK/);
  assert.equal(calls(f).filter(c => c.args[0] === 'bootstrap').length, 2);
  const linked = fixture(); fs.symlinkSync(path.join(linked.backup, 'keep.txt'), path.join(linked.source, 'linked.json'));
  const before = tree(linked.root), denied = call(linked, 'install_mac.sh', ['--data', linked.data]);
  assert.notEqual(denied.status, 0); assert.match(denied.out, /링크/); assert.deepEqual(tree(linked.root), before);
  const inside = fixture(), unsafe = call(inside, 'install_mac.sh', ['--data', path.join(inside.game, 'records')]);
  assert.notEqual(unsafe.status, 0); assert(!fs.existsSync(path.join(inside.game, 'records')));
});

test('MAC3: an occupied destination or existing agent configuration stops before any file changes', () => {
  const f = fixture(); write(path.join(f.data, 'p.son.json'), 'do not overwrite this newer record\n');
  write(path.join(f.data, 'daily/keep.json'), 'keep both copies\n');
  const before = tree(f.root), r = call(f, 'install_mac.sh', ['--data', f.data]);
  assert.notEqual(r.status, 0); assert.match(r.out, /파일 목록과 수정 시각/); assert.match(r.out, /p\.son\.json/); assert.match(r.out, /비어 있지/);
  assert.deepEqual(tree(f.root), before); assert.equal(calls(f).length, 0);
  const existing = fixture(); write(plistPath(existing, serverLabel), 'existing user configuration');
  const saved = tree(existing.root), denied = call(existing, 'install_mac.sh', ['--data', existing.data]);
  assert.notEqual(denied.status, 0); assert.deepEqual(tree(existing.root), saved);
});

test('MAC4: both valid plists contain explicit server paths and the optional 21:07 backup schedule', () => {
  const f = fixture(); install(f);
  const server = plist(plistPath(f, serverLabel)), backup = plist(plistPath(f, backupLabel));
  assert.equal(server.Label, serverLabel); assert(path.isAbsolute(server.ProgramArguments[0]));
  assert.deepEqual(server.ProgramArguments.slice(1), [path.join(f.game, 'tools/serve_cards.py'), '--host', '0.0.0.0', '--port', '8090', '--state-dir', f.data]);
  assert.equal(server.WorkingDirectory, f.game); assert.equal(server.RunAtLoad, true); assert.equal(server.KeepAlive, true);
  assert.equal(server.EnvironmentVariables.CARDS_STATE_DIR, f.data); assert.equal(server.StandardOutPath, path.join(f.home, 'Library/Logs/english-voca-server.log'));
  assert.deepEqual(backup.ProgramArguments, ['/bin/bash', path.join(f.game, 'tools/backup_state.sh')]);
  assert.deepEqual(backup.StartCalendarInterval, { Hour: 21, Minute: 7 });
  assert.equal(backup.EnvironmentVariables.CARDS_STATE_DIR, f.data); assert.equal(backup.EnvironmentVariables.CARDS_BACKUP_REPO, f.backup);
  assert.notEqual(backup.RunAtLoad, true); assert.notEqual(backup.KeepAlive, true);
  const tool = spawnSync('sh', ['-c', 'command -v plutil'], { encoding: 'utf8' });
  if (tool.status === 0) for (const label of [serverLabel, backupLabel]) {
    const checked = spawnSync(tool.stdout.trim(), ['-lint', '--', plistPath(f, label)], { encoding: 'utf8' });
    assert.equal(checked.status, 0, checked.stdout + checked.stderr);
  } // plistlib above validates XML on hosts without plutil.
  const noBackup = fixture(), r = call(noBackup, 'install_mac.sh', ['--data', noBackup.data]);
  assert.equal(r.status, 0, r.out); assert(!fs.existsSync(plistPath(noBackup, backupLabel)));
});

test('MAC5: uninstall unloads only the two generated agents and preserves every original/data/backup file', () => {
  const f = fixture(); install(f); write(path.join(f.data, 'p.daughter.json'), 'played after installation\n');
  const before = [tree(f.source), tree(f.data), tree(f.backup)], r = call(f, 'uninstall_mac.sh');
  assert.equal(r.status, 0, r.out); assert(!fs.existsSync(plistPath(f, serverLabel))); assert(!fs.existsSync(plistPath(f, backupLabel)));
  assert.deepEqual([tree(f.source), tree(f.data), tree(f.backup)], before); assert.equal(calls(f).filter(c => c.args[0] === 'bootout').length, 2);
  assert.equal(call(f, 'uninstall_mac.sh').status, 0);
  const foreign = fixture(); write(plistPath(foreign, serverLabel), '<?xml version="1.0"?><plist version="1.0"><dict><key>Label</key><string>somebody.else</string></dict></plist>');
  const saved = tree(foreign.root), denied = call(foreign, 'uninstall_mac.sh');
  assert.notEqual(denied.status, 0); assert.deepEqual(tree(foreign.root), saved);
  const aliased = fixture(); install(aliased);
  const retained = path.join(aliased.data, 'agent-config'); fs.cpSync(aliased.agents, retained, { recursive: true });
  fs.renameSync(aliased.agents, aliased.agents + '.retained'); fs.symlinkSync(retained, aliased.agents);
  const protectedBefore = tree(aliased.data), aliasResult = call(aliased, 'uninstall_mac.sh');
  assert.notEqual(aliasResult.status, 0); assert.match(aliasResult.out, /기록 또는 백업/); assert.deepEqual(tree(aliased.data), protectedBefore);
});

test('MAC6: update copies before pull, preserves older snapshots and leaves a running server alone on pull failure', () => {
  const f = fixture(); execFileSync('git', ['init', '-q', '-b', 'main', f.game]); install(f);
  const original = tree(f.source), privateBackup = tree(f.backup), recordHash = hash(path.join(f.data, 'p.son.json'));
  const preview = tree(f.root), dry = call(f, 'update_mac.sh', ['--dry-run']);
  assert.equal(dry.status, 0, dry.out); assert.deepEqual(tree(f.root), preview);
  const r = call(f, 'update_mac.sh'); assert.equal(r.status, 0, r.out); assert.match(r.out, /\/api\/ping: OK/);
  const archive = path.join(f.data, 'before-update'), first = fs.readdirSync(archive); assert.equal(first.length, 1);
  const firstTree = tree(path.join(archive, first[0])); assert.equal(hash(path.join(archive, first[0], 'p.son.json')), recordHash);
  const events = calls(f), pullAt = events.findIndex(c => c.cmd === 'git'); assert(pullAt >= 0);
  assert(events.slice(pullAt + 1).some(c => c.cmd === 'launchctl' && c.args[0] === 'kickstart'));
  const eventCount = events.length, jobsBefore = fs.readFileSync(f.state, 'utf8');
  const failed = call(f, 'update_mac.sh', [], { MAC_FAKE_GIT_FAIL: '1' });
  assert.notEqual(failed.status, 0); assert.match(failed.out, /서버를 중지\/재시작하지 않았/);
  assert.equal(fs.readFileSync(f.state, 'utf8'), jobsBefore);
  assert(!calls(f).slice(eventCount).some(c => c.cmd === 'launchctl' && ['kickstart', 'bootout', 'bootstrap'].includes(c.args[0])));
  assert.equal(fs.readdirSync(archive).length, 2); assert.deepEqual(tree(path.join(archive, first[0])), firstTree);
  assert.equal(hash(path.join(f.data, 'p.son.json')), recordHash); assert.deepEqual(tree(f.source), original); assert.deepEqual(tree(f.backup), privateBackup);
  fs.symlinkSync(path.join(f.backup, 'keep.txt'), path.join(f.data, 'linked.json'));
  const saved = tree(f.root), denied = call(f, 'update_mac.sh'); assert.notEqual(denied.status, 0); assert.deepEqual(tree(f.root), saved);
});
