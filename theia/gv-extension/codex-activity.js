function diffCounts(diff) {
  const lines = String(diff || '').split(/\r?\n/);
  return {
    added: lines.filter((line) => line.startsWith('+') && !line.startsWith('+++')).length,
    removed: lines.filter((line) => line.startsWith('-') && !line.startsWith('---')).length,
  };
}

function describeAgentActivity(event) {
  if (event.type === 'read_file') return { heading: 'Thinking', detail: `Reading ${event.detail || 'a project file'}` };
  if (event.type === 'search_text') return { heading: 'Thinking', detail: `Searching for ${event.detail || 'project text'}` };
  if (event.type === 'propose_file_change') return { heading: 'Thinking', detail: 'Preparing a file change proposal' };
  if (event.type === 'propose_terminal_command') return { heading: 'Thinking', detail: 'Preparing a command proposal' };
  if (event.type === 'action') {
    const action = event.action || {}, { added, removed } = diffCounts(action.diff);
    if (action.type === 'command') return { heading: 'Command proposed', detail: action.command || '' };
    const verb = action.type === 'delete' ? 'Deleted' : 'Edited';
    return { heading: `${verb} 1 file +${added} -${removed}`, detail: action.path || '' };
  }
  return { heading: 'Thinking', detail: 'Using project tools' };
}

module.exports = { describeAgentActivity, diffCounts };
