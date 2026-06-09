const defaultCodexModel = "gpt-5.4-mini";
const defaultClaudeModel = "haiku";

const codexSkillTarget = {
  homeVar: "CODEX_HOME",
  userSkillsDir: "$HOME/.codex/skills",
};
const claudeSkillTarget = {
  homeVar: "CLAUDE_CONFIG_DIR",
  userSkillsDir: "$HOME/.claude/skills",
};

export function buildCodexExecArgs({
  repo,
  prompt,
  model = defaultCodexModel,
  isolated = true,
}) {
  const args = [
    "exec",
    "-m",
    model,
    "--color",
    "never",
  ];

  if (isolated) {
    args.push(
      "--ignore-user-config",
      "--ignore-rules",
      "--dangerously-bypass-approvals-and-sandbox",
    );
  }

  args.push(
    "-C",
    repo,
    prompt,
  );

  return args;
}

export function buildClaudePrintArgs({
  prompt,
  model = defaultClaudeModel,
  isolated = true,
}) {
  const args = [
    "-p",
    "--model",
    model,
    "--output-format",
    "stream-json",
    "--verbose",
  ];

  if (isolated) {
    args.push(
      "--strict-mcp-config",
      "--permission-mode",
      "bypassPermissions",
    );
  }

  args.push(prompt);
  return args;
}

export function renderShellCommand(command, args) {
  return [command, ...args].map(shellQuote).join(" ");
}

export function renderIsolatedCodexShellCommand(args, skills = []) {
  const setup = [
    'CODEX_HOME="$(mktemp -d "${TMPDIR:-/tmp}/agent-dogfeed-codex-home.XXXXXX")"',
    "export CODEX_HOME",
    renderSessionSaveSetup("codex", "$CODEX_HOME/sessions", "$CODEX_HOME"),
    'install -m 600 "$HOME/.codex/auth.json" "$CODEX_HOME/auth.json"',
    // codex discovers skills from $HOME/.agents/skills regardless of
    // CODEX_HOME or --ignore-user-config, so the probe runs with an overlay
    // home that symlinks everything except cross-agent state.
    'mkdir "$CODEX_HOME/home"',
    'find "$HOME" -mindepth 1 -maxdepth 1 ! -name .agents ! -name .claude ! -name .codex ! -name .pi -exec sh -c \'for e; do ln -s "$e" "$CODEX_HOME/home/${e##*/}"; done\' _ {} +',
  ];

  if (skills.length > 0) {
    setup.push('mkdir -p "$CODEX_HOME/skills"');
  }

  for (const skill of skills) {
    setup.push(renderSkillLinkCommand(skill, codexSkillTarget));
  }

  return [
    ...setup,
    `HOME="$CODEX_HOME/home" ${renderShellCommand("codex", args)}`,
  ].join("; ");
}

export function renderClaudeShellCommand(repo, args) {
  return `cd ${shellQuote(repo)} && ${renderShellCommand("claude", args)}`;
}

export function renderIsolatedClaudeShellCommand(repo, args, skills = []) {
  const setup = [
    'CLAUDE_CONFIG_DIR="$(mktemp -d "${TMPDIR:-/tmp}/agent-dogfeed-claude-home.XXXXXX")"',
    "export CLAUDE_CONFIG_DIR",
    renderSessionSaveSetup("claude", "$CLAUDE_CONFIG_DIR/projects", "$CLAUDE_CONFIG_DIR"),
    'security find-generic-password -w -s "Claude Code-credentials" -a "$USER" > "$CLAUDE_CONFIG_DIR/.credentials.json"',
    'chmod 600 "$CLAUDE_CONFIG_DIR/.credentials.json"',
  ];

  if (skills.length > 0) {
    setup.push('mkdir -p "$CLAUDE_CONFIG_DIR/skills"');
  }

  for (const skill of skills) {
    setup.push(renderSkillLinkCommand(skill, claudeSkillTarget));
  }

  return [
    ...setup,
    renderClaudeShellCommand(repo, args),
  ].join("; ");
}

function renderSessionSaveSetup(probeName, sessionsRoot, tempHome) {
  const saveDir = "$AGENT_DOGFEED_SESSION_DIR";
  return [
    `AGENT_DOGFEED_SESSION_DIR="$(mktemp -d "\${TMPDIR:-/tmp}/agent-dogfeed-${probeName}-session.XXXXXX")"`,
    `trap 'find "${sessionsRoot}" -name "*.jsonl" -exec cp {} "${saveDir}/" \\; 2>/dev/null; echo "agent-dogfeed: probe session saved in ${saveDir}" >&2; rm -rf "${tempHome}"' EXIT`,
  ].join("; ");
}

function shellQuote(value) {
  if (/^[A-Za-z0-9_./:=@%+-]+$/.test(value)) {
    return value;
  }

  return `'${value.replaceAll("'", "'\\''")}'`;
}

function renderSkillLinkCommand(skill, { homeVar, userSkillsDir }) {
  if (skill.includes("/") || skill.startsWith(".")) {
    return `ln -s ${shellQuote(skill)} "$${homeVar}/skills/$(basename ${shellQuote(skill)})"`;
  }

  return `ln -s "${userSkillsDir}/${skill}" "$${homeVar}/skills/${skill}"`;
}
