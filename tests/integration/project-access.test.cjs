const assert = require('node:assert/strict');
const test = require('node:test');
const { requireProjectAction, assertMemberRoleChange, ProjectAccessError } = require('../../apps/api/dist/modules/projects/policy');

const project = {
  id: 'project-1',
  ownerUserId: 'owner-1',
  visibility: 'private',
  members: new Map([
    ['maintainer-1', 'maintainer'],
    ['developer-1', 'developer'],
    ['viewer-1', 'viewer']
  ])
};
const actor = (userId, platformRole = 'user') => ({ userId, platformRole });

test('developer may edit source but cannot publish or transfer ownership', () => {
  assert.deepEqual(requireProjectAction(actor('developer-1'), project, 'edit_source'), {
    projectId: 'project-1', userId: 'developer-1', role: 'developer', action: 'edit_source'
  });
  for (const action of ['publish_release', 'transfer_ownership']) {
    assert.throws(() => requireProjectAction(actor('developer-1'), project, action), error => error instanceof ProjectAccessError && error.statusCode === 404);
  }
});

test('maintainer can manage developers and viewers but cannot elevate a maintainer or change owner', () => {
  assert.doesNotThrow(() => assertMemberRoleChange(actor('maintainer-1'), project, 'developer'));
  assert.doesNotThrow(() => assertMemberRoleChange(actor('maintainer-1'), project, 'viewer'));
  for (const role of ['maintainer', 'owner']) {
    assert.throws(() => assertMemberRoleChange(actor('maintainer-1'), project, role), error => error instanceof ProjectAccessError && error.statusCode === 404);
  }
  assert.throws(() => requireProjectAction(actor('maintainer-1'), project, 'transfer_ownership'), error => error.statusCode === 404);
});

test('viewer can read private source but cannot edit it, and system admin gains no implicit source access', () => {
  assert.equal(requireProjectAction(actor('viewer-1'), project, 'read_source').role, 'viewer');
  assert.throws(() => requireProjectAction(actor('viewer-1'), project, 'edit_source'), error => error.statusCode === 404);
  assert.throws(() => requireProjectAction(actor('admin-1', 'system_admin'), project, 'read_source'), error => error.statusCode === 404);
});

test('a public release permits metadata only, never anonymous source access', () => {
  const publicProject = { ...project, visibility: 'public', members: new Map() };
  assert.equal(requireProjectAction(null, publicProject, 'read_metadata').role, 'public');
  assert.throws(() => requireProjectAction(null, publicProject, 'read_source'), error => error.statusCode === 404);
});
