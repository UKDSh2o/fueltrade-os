import test from 'node:test';
import assert from 'node:assert/strict';
import { effectiveNotificationReadAt, notificationReadStateId } from '../lib/notification-controls.js';

test('notification read-state keys are user-specific', () => {
  assert.equal(notificationReadStateId('event-a', 'user-a'), 'event-a:user-a');
  assert.notEqual(notificationReadStateId('event-a', 'user-a'), notificationReadStateId('event-a', 'user-b'));
  assert.equal(notificationReadStateId('', 'user-a'), '');
});

test('personal state overrides legacy owner state without leaking to participants', () => {
  assert.equal(effectiveNotificationReadAt({ personalStateExists: false, legacyReadAt: 100, isOwner: true }), 100);
  assert.equal(effectiveNotificationReadAt({ personalStateExists: false, legacyReadAt: 100, isOwner: false }), null);
  assert.equal(effectiveNotificationReadAt({ personalStateExists: true, personalReadAt: null, legacyReadAt: 100, isOwner: true }), null);
  assert.equal(effectiveNotificationReadAt({ personalStateExists: true, personalReadAt: 200, legacyReadAt: null, isOwner: false }), 200);
});
